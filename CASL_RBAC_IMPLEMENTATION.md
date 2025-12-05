# CASL-Based RBAC Implementation

This document describes the optimized Role-Based Access Control (RBAC) implementation using CASL (Code Access Security Library) in the NestJS backend.

## Architecture Overview

The implementation follows the architecture you described:

1. **Database Storage**: Roles and permissions are stored in the database with proper relationships
2. **JWT Integration**: User permissions are loaded at login and included in the JWT context
3. **CASL Guards**: Fine-grained permission checking using CASL abilities
4. **Dynamic Control**: Change permissions in DB and routes automatically respect new rules

## Database Schema

The schema includes:
- `Role`: Stores role information (id, name, description)
- `Permission`: Stores permissions with resource and action (e.g., 'user:create', 'product:read')
- `RolePermission`: Join table linking roles to permissions
- `User`: Has a `roleId` foreign key to Role

## Components

### 1. RolesService (`src/roles/roles.service.ts`)

Added method to load user permissions for CASL:
- `getUserPermissionsWithDetails(userId)`: Returns full permission objects for CASL ability building

### 2. AbilityFactory (`src/common/services/ability.factory.ts`)

Creates CASL abilities from user permissions:
- `createForUser(userId)`: Loads permissions from DB and creates CASL ability
- `createFromPermissions(permissions)`: Creates ability from permission strings (for testing)

### 3. JWT Strategy (`src/auth/strategy/jwt.strategy.ts`)

Updated to:
- Load user permissions from database
- Create CASL ability for the user
- Attach ability to user object and request for authorization checks

### 4. PermissionsGuard (`src/auth/guard/permissions.guard.ts`)

CASL-based guard that:
- Extracts required permissions from route metadata
- Checks user's CASL ability against required permissions
- Supports wildcard permissions (e.g., 'user:*' matches all user actions)

### 5. @Permissions Decorator (`src/auth/decorator/permissions.decorator.ts`)

Decorator to specify required permissions for routes:
```typescript
@Permissions('user:create', 'user:read')
```

## Usage Examples

### Basic Permission Check

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtGuard, PermissionsGuard } from 'src/auth/guard';
import { Permissions } from 'src/auth/decorator';

@Controller('users')
export class UserController {
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('user:create')
  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    // Only users with 'user:create' permission can access
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('user:read')
  @Get()
  async getUsers() {
    // Only users with 'user:read' permission can access
  }
}
```

### Multiple Permissions

```typescript
@UseGuards(JwtGuard, PermissionsGuard)
@Permissions('user:read', 'user:update')
@Get(':id')
async getUser(@Param('id') id: number) {
  // User needs both 'user:read' AND 'user:update' permissions
}
```

### Using CASL Ability in Controllers

You can also use the ability directly in controllers for more complex checks:

```typescript
import { GetUser } from 'src/auth/decorator';
import { AppAbility } from 'src/common/services/ability.factory';

@Controller('products')
export class ProductController {
  @UseGuards(JwtGuard)
  @Get(':id')
  async getProduct(
    @Param('id') id: number,
    @GetUser() user: any,
    @Req() req: Request,
  ) {
    const ability = req.ability || user.ability;
    
    // Check if user can read this specific product
    if (!ability.can('read', 'product')) {
      throw new ForbiddenException('Cannot read products');
    }
    
    // Row-level permission check (if product has userId)
    const product = await this.productService.findOne(id);
    if (product.userId !== user.id && !ability.can('manage', 'product')) {
      throw new ForbiddenException('Cannot read this product');
    }
    
    return product;
  }
}
```

### Wildcard Permissions

The system supports wildcard permissions:
- `'user:*'` - All actions on user resource
- `'*:read'` - Read action on all resources
- `'*:*'` or `'manage'` - All actions on all resources

## Permission Format

Permissions follow the format: `resource:action`

**Resources**: user, product, role, permission, etc.
**Actions**: create, read, update, delete, manage, *

Examples:
- `user:create` - Create users
- `user:read` - Read users
- `user:update` - Update users
- `user:delete` - Delete users
- `user:*` - All user actions
- `*:read` - Read all resources

## Setting Up Permissions

### 1. Create Permissions

```bash
POST /roles/permissions
{
  "name": "Create Users",
  "resource": "user",
  "action": "create",
  "description": "Permission to create new users"
}
```

### 2. Assign Permissions to Roles

```bash
POST /roles/:roleId/permissions
{
  "permissionIds": [1, 2, 3] // Array of permission IDs
}
```

### 3. Assign Roles to Users

Users are assigned roles via the `roleId` field in the User model.

## Combining with RolesGuard

You can use both `RolesGuard` and `PermissionsGuard` together:

```typescript
@UseGuards(JwtGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN)
@Permissions('user:create')
@Post('users')
async createUser() {
  // User must be ADMIN AND have 'user:create' permission
}
```

## Performance Considerations

1. **Caching**: Permissions are loaded once per request in JWT strategy and cached on the request object
2. **Database Queries**: Permission loading is optimized with proper Prisma includes
3. **CASL Abilities**: Created once per request and reused

## Security Features

1. **Server-side Only**: All permission checks happen server-side, never trusted from client
2. **Database-Driven**: Permissions are loaded from database, ensuring real-time updates
3. **Fail-Secure**: If permission check fails, access is denied
4. **Wildcard Support**: Supports flexible permission patterns
5. **Row-Level**: Can be extended for row-level permissions using CASL conditions

## Next Steps

For Next.js frontend integration:
1. Decode JWT token in Next.js middleware/server components
2. Use CASL ability from JWT payload (if needed) or make API calls to check permissions
3. Alternatively, create a dedicated endpoint to get user permissions for frontend UI control
4. Use permissions to show/hide UI elements based on API responses

## Files Modified/Created

- ✅ `src/roles/roles.service.ts` - Added permission loading methods
- ✅ `src/common/services/ability.factory.ts` - CASL ability factory (NEW)
- ✅ `src/auth/strategy/jwt.strategy.ts` - Load permissions and create abilities
- ✅ `src/auth/guard/permissions.guard.ts` - Permission-based guard (NEW)
- ✅ `src/auth/decorator/permissions.decorator.ts` - @Permissions decorator (NEW)
- ✅ `src/common/types/express.d.ts` - Type definitions for Request.ability (NEW)
- ✅ `src/common/common.module.ts` - Export AbilityFactory
- ✅ `src/auth/auth.module.ts` - Import RolesModule

## Testing

To test the implementation:

1. Create permissions via `/roles/permissions`
2. Assign permissions to roles via `/roles/:id/permissions`
3. Login as a user with that role
4. Access protected routes - should work if permissions match
5. Try accessing without required permissions - should get 403 Forbidden

