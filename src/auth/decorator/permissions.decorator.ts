import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to specify required permissions for a route
 * 
 * @param permissions Array of permission strings in format 'resource:action'
 *                    Examples: ['user:create', 'user:read', 'product:update']
 *                    Supports wildcards: ['user:*', '*:read']
 * 
 * @example
 * @UseGuards(JwtGuard, PermissionsGuard)
 * @Permissions('user:create')
 * @Post('users')
 * 
 * @example
 * @UseGuards(JwtGuard, PermissionsGuard)
 * @Permissions('user:read', 'user:update')
 * @Get('users/:id')
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

