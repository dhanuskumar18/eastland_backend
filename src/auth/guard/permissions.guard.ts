import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorator/permissions.decorator';
import { AbilityFactory, AppAbility } from '../../common/services/ability.factory';

/**
 * PermissionsGuard - Permission-Based Access Control (PBAC) Guard using CASL
 * 
 * This guard provides fine-grained permission checking using CASL abilities.
 * It checks if the user has the required permissions to access a route.
 * 
 * How it works:
 * 1. Extracts required permissions from route metadata (set via @Permissions() decorator)
 * 2. Gets user's CASL ability from request (set by JWT strategy)
 * 3. Checks if user's ability allows the required permissions
 * 4. Supports wildcard permissions (e.g., 'user:*' matches 'user:create', 'user:read', etc.)
 * 
 * Security features:
 * - Server-side only: Permissions are validated from database, never from client input
 * - Fine-grained control: Check specific actions on specific resources
 * - Wildcard support: Supports '*' for actions or resources
 * - Fail-secure: If permission check fails, access is denied
 * 
 * Usage:
 * @UseGuards(JwtGuard, PermissionsGuard)
 * @Permissions('user:create')
 * @Post('users')
 * 
 * @UseGuards(JwtGuard, PermissionsGuard)
 * @Permissions('user:read', 'user:update')
 * @Get('users/:id')
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private abilityFactory: AbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions are specified, allow access (no permission restriction)
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User should be set by JwtGuard
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get user's ability from request (set by JWT strategy)
    // If not set, create it on-the-fly (less optimal but works)
    let ability: AppAbility = request.ability;
    
    if (!ability) {
      ability = await this.abilityFactory.createForUser(user.id);
      // Cache it for this request
      request.ability = ability;
    }

    // Check each required permission
    for (const permission of requiredPermissions) {
      const [resource, action] = permission.split(':');
      
      if (!resource || !action) {
        throw new ForbiddenException(
          `Invalid permission format: ${permission}. Expected format: 'resource:action'`,
        );
      }

      // Check if user can perform the action on the resource
      const canPerform = ability.can(
        action.toLowerCase() as any,
        resource.toLowerCase(),
      );

      if (!canPerform) {
        throw new ForbiddenException(
          `Insufficient permissions. Required: ${permission}`,
        );
      }
    }

    return true;
  }
}

