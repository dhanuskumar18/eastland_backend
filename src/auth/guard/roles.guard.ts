import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorator/roles.decorator';
import { UserRole } from '@prisma/client';

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
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user has role and if it matches required roles
    const userRole = user.role?.name;
    if (!userRole) {
      throw new ForbiddenException('User role not found');
    }

    const hasRole = requiredRoles.some((role) => role === userRole);
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions. Admin access required.');
    }

    return true;
  }
}

