import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorator/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * RolesGuard - Role-Based Access Control (RBAC) Guard
 * 
 * ACCESS CONTROL CHECKLIST ITEM #2 & #4:
 * - Protects user roles, permissions, and policy data from manipulation by end users
 * - Prevents vertical privilege escalation (role escalation attacks)
 * 
 * How it works:
 * 1. Extracts required roles from route metadata (set via @Roles() decorator)
 * 2. Verifies user's role from JWT token (server-side validation only - roles never trusted from client)
 * 3. Compares user's role against required roles
 * 4. Rejects access if role doesn't match (prevents privilege escalation)
 * 
 * Security features:
 * - Server-side only: Roles are validated from database via JWT token, never from client input
 * - Role data protection: User roles are fetched from database in JwtStrategy, not from request body/headers
 * - Vertical escalation prevention: Users cannot access endpoints requiring higher privileges
 * - Fail-secure: If role check fails, access is denied
 * 
 * Usage:
 * @UseGuards(JwtGuard, RolesGuard)
 * @Roles(UserRole.ADMIN)
 * @Get('admin-only')
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are specified, allow access (no role restriction)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User should be set by JwtGuard
    // Security: User object comes from JWT token validation, not from client input
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Security: Role is fetched from database in JwtStrategy.validate(), not from request
    // This prevents role manipulation attacks where users try to send fake role data
    const userRole = user.role?.name;
    if (!userRole) {
      throw new ForbiddenException('User role not found');
    }

    // Vertical privilege escalation prevention:
    // Users can only access endpoints if their role matches required roles
    // Example: USER role cannot access ADMIN-only endpoints
    const hasRole = requiredRoles.some((role) => role === userRole);
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions. Admin access required.');
    }

    return true;
  }
}

