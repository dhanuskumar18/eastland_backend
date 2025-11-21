import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../../database/database.service';

export const RESOURCE_OWNER_KEY = 'resourceOwner';
export const ResourceOwner = (resourceType: string, userIdParam: string = 'id') =>
  SetMetadata(RESOURCE_OWNER_KEY, { resourceType, userIdParam });

/**
 * ResourceOwnershipGuard - Resource Ownership Validation Guard
 * 
 * ACCESS CONTROL CHECKLIST ITEM #3:
 * - Ensures users can only access resources they explicitly own or are authorized for
 * - Prevents horizontal privilege escalation (same-level access attacks)
 * 
 * How it works:
 * 1. Extracts resource ID from route parameters
 * 2. Fetches resource from database
 * 3. Verifies resource ownership (userId matches resource owner)
 * 4. Rejects access if user doesn't own the resource (unless admin)
 * 
 * Security features:
 * - Horizontal escalation prevention: Users cannot access other users' resources
 * - Server-side validation: Ownership checked from database, not from client
 * - Admin bypass: Admins can access any resource (for management purposes)
 * - Fail-secure: If ownership check fails, access is denied
 * 
 * Usage:
 * @UseGuards(JwtGuard, ResourceOwnershipGuard)
 * @ResourceOwner('user', 'id') // Check if resource type 'user' with param 'id' belongs to current user
 * @Get(':id')
 */
@Injectable()
export class ResourceOwnershipGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Skip if no user (let JwtGuard handle authentication)
    if (!user) {
      return true;
    }

    // Get resource ownership metadata from route
    const resourceConfig = this.reflector.getAllAndOverride<{
      resourceType: string;
      userIdParam: string;
    }>(RESOURCE_OWNER_KEY, [context.getHandler(), context.getClass()]);

    // If no resource ownership check required, allow access
    if (!resourceConfig) {
      return true;
    }

    const { resourceType, userIdParam } = resourceConfig;
    const resourceId = request.params[userIdParam];

    if (!resourceId) {
      return true; // No resource ID in params, skip check
    }

    // Admin users can access any resource (for management purposes)
    // This is intentional - admins need to manage all resources
    if (user.role?.name === 'ADMIN') {
      return true;
    }

    // Fetch resource from database and verify ownership
    // Security: Ownership is checked server-side from database, not from client input
    const resource = await this.getResource(resourceType, resourceId);

    if (!resource) {
      throw new NotFoundException(`${resourceType} not found`);
    }

    // Check if resource belongs to current user
    // This prevents horizontal privilege escalation (User A accessing User B's resources)
    const resourceOwnerId = this.getResourceOwnerId(resource, resourceType);
    
    if (resourceOwnerId !== user.id) {
      throw new ForbiddenException({
        success: false,
        message: 'You do not have permission to access this resource',
        code: 'RESOURCE_OWNERSHIP_VIOLATION',
        statusCode: 403,
      });
    }

    return true;
  }

  /**
   * Get resource from database based on resource type
   */
  private async getResource(resourceType: string, resourceId: string | number) {
    const id = typeof resourceId === 'string' ? parseInt(resourceId, 10) : resourceId;

    switch (resourceType.toLowerCase()) {
      case 'user':
        return this.prisma.user.findUnique({
          where: { id },
          select: { id: true }, // For user resources, the ID itself is the owner
        });
      case 'session':
        return this.prisma.session.findUnique({
          where: { id: String(resourceId) },
          select: { id: true, userId: true },
        });
      // Add more resource types as needed
      // case 'product':
      //   return this.prisma.product.findUnique({ where: { id }, select: { id: true, userId: true } });
      default:
        return null;
    }
  }

  /**
   * Extract owner ID from resource based on resource type
   */
  private getResourceOwnerId(resource: any, resourceType: string): number | null {
    // Most resources have userId field
    if (resource.userId) {
      return resource.userId;
    }

    // Some resources might have different field names
    switch (resourceType.toLowerCase()) {
      case 'user':
        // For user resources, the ID itself is the owner
        return resource.id;
      default:
        return resource.userId || null;
    }
  }
}

