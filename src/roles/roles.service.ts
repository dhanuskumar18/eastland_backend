import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PaginationDto } from '../brand/dto/pagination.dto';
import { AuditLogService, AuditAction } from '../common/services/audit-log.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ==================== Role CRUD Operations ====================

  async create(
    dto: CreateRoleDto,
    performedBy?: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      const role = await this.db.role.create({
        data: {
          name: dto.name,
          description: dto.description,
        },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });

      await this.auditLog.logSuccess({
        userId: performedBy,
        action: AuditAction.RESOURCE_CREATED,
        resource: 'Role',
        resourceId: role.id,
        details: {
          roleName: role.name,
          description: role.description,
        },
        ipAddress,
        userAgent,
      });

      return role;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException('Role name already exists');
        }
      }
      throw error;
    }
  }

  async findAll(paginationDto?: PaginationDto) {
    if (paginationDto && (paginationDto.page !== undefined || paginationDto.limit !== undefined)) {
      const page = paginationDto.page ?? 1;
      const limit = paginationDto.limit ?? 10;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.db.role.findMany({
          skip,
          take: limit,
          orderBy: { id: 'desc' },
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
            _count: {
              select: {
                users: true,
              },
            },
          },
        }),
        this.db.role.count(),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    }

    const data = await this.db.role.findMany({
      orderBy: { id: 'desc' },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    return data;
  }

  async findOne(id: number) {
    const role = await this.db.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async update(
    id: number,
    dto: UpdateRoleDto,
    performedBy?: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.db.role.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    const data: { name?: string; description?: string } = {};
    const changes: any = {};

    if (dto.name !== undefined && dto.name !== existing.name) {
      data.name = dto.name;
      changes.name = { from: existing.name, to: dto.name };
    }

    if (dto.description !== undefined && dto.description !== existing.description) {
      data.description = dto.description;
      changes.description = { from: existing.description, to: dto.description };
    }

    if (Object.keys(data).length === 0) {
      return this.findOne(id);
    }

    try {
      const updated = await this.db.role.update({
        where: { id },
        data,
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
          _count: {
            select: {
              users: true,
            },
          },
        },
      });

      await this.auditLog.logSuccess({
        userId: performedBy,
        action: AuditAction.RESOURCE_UPDATED,
        resource: 'Role',
        resourceId: id,
        details: { changes },
        ipAddress,
        userAgent,
      });

      return updated;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const newName = data.name || dto.name;
          throw new BadRequestException(
            `Role name "${newName}" already exists. Please choose a different name.`,
          );
        } else if (error.code === 'P2003') {
          throw new BadRequestException('Foreign key constraint violation');
        } else {
          this.logger.error(
            `Failed to update role ${id}`,
            error instanceof Error ? error.stack : error,
          );
          throw new BadRequestException(`Database error: ${error.message}`);
        }
      }
      
      // Log unexpected errors
      this.logger.error(
        `Unexpected error updating role ${id}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async remove(
    id: number,
    performedBy?: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.db.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    // Check if role is assigned to any users
    if (existing._count.users > 0) {
      throw new BadRequestException(
        `Cannot delete role. It is assigned to ${existing._count.users} user(s). Please reassign users first.`,
      );
    }

    const result = await this.db.role.delete({
      where: { id },
    });

    await this.auditLog.logSuccess({
      userId: performedBy,
      action: AuditAction.RESOURCE_DELETED,
      resource: 'Role',
      resourceId: id,
      details: {
        deletedRole: {
          id: existing.id,
          name: existing.name,
        },
      },
      ipAddress,
      userAgent,
    });

    return result;
  }

  // ==================== Permission Management ====================

  async assignPermissions(
    roleId: number,
    dto: AssignPermissionsDto,
    performedBy?: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const role = await this.db.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Validate that all permission IDs exist
    const existingPermissions = await this.db.permission.findMany({
      where: {
        id: {
          in: dto.permissionIds,
        },
      },
    });

    if (existingPermissions.length !== dto.permissionIds.length) {
      const foundIds = existingPermissions.map((p) => p.id);
      const missingIds = dto.permissionIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `Permissions not found: ${missingIds.join(', ')}`,
      );
    }

    // Get current permission IDs
    const currentPermissionIds = role.permissions.map((rp) => rp.permissionId);

    // Find permissions to add and remove
    const permissionsToAdd = dto.permissionIds.filter(
      (id) => !currentPermissionIds.includes(id),
    );
    const permissionsToRemove = currentPermissionIds.filter(
      (id) => !dto.permissionIds.includes(id),
    );

    // Perform the update
    await this.db.$transaction([
      // Remove permissions that are no longer assigned
      ...(permissionsToRemove.length > 0
        ? [
            this.db.rolePermission.deleteMany({
              where: {
                roleId,
                permissionId: {
                  in: permissionsToRemove,
                },
              },
            }),
          ]
        : []),
      // Add new permissions
      ...(permissionsToAdd.length > 0
        ? [
            this.db.rolePermission.createMany({
              data: permissionsToAdd.map((permissionId) => ({
                roleId,
                permissionId,
              })),
            }),
          ]
        : []),
    ]);

    const updated = await this.findOne(roleId);

    await this.auditLog.logSuccess({
      userId: performedBy,
      action: AuditAction.PERMISSION_GRANTED,
      resource: 'Role',
      resourceId: roleId,
      details: {
        roleName: role.name,
        permissionsAdded: permissionsToAdd,
        permissionsRemoved: permissionsToRemove,
        totalPermissions: dto.permissionIds.length,
      },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  // ==================== Permission CRUD Operations ====================

  async createPermission(
    dto: CreatePermissionDto,
    performedBy?: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      const permission = await this.db.permission.create({
        data: {
          name: dto.name,
          resource: dto.resource,
          action: dto.action,
          description: dto.description,
        },
        include: {
          _count: {
            select: {
              roles: true,
            },
          },
        },
      });

      await this.auditLog.logSuccess({
        userId: performedBy,
        action: AuditAction.RESOURCE_CREATED,
        resource: 'Permission',
        resourceId: permission.id,
        details: {
          permissionName: permission.name,
          resource: permission.resource,
          action: permission.action,
        },
        ipAddress,
        userAgent,
      });

      return permission;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'Permission name already exists or resource-action combination already exists',
          );
        }
      }
      throw error;
    }
  }

  async createPermissionsBatch(
    dtos: CreatePermissionDto[],
    performedBy?: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    type PermissionWithCount = Awaited<
      ReturnType<typeof this.db.permission.create>
    > & {
      _count: { roles: number };
    };
    type FailedPermission = {
      permission: CreatePermissionDto;
      error: string;
    };

    const results: PermissionWithCount[] = [];
    const errors: FailedPermission[] = [];

    // Use transaction for atomicity - all succeed or all fail
    try {
      const created = await this.db.$transaction(
        dtos.map((dto) =>
          this.db.permission.create({
            data: {
              name: dto.name,
              resource: dto.resource,
              action: dto.action,
              description: dto.description,
            },
            include: {
              _count: {
                select: {
                  roles: true,
                },
              },
            },
          }),
        ),
      );

      // Log audit for each created permission
      for (const permission of created) {
        await this.auditLog.logSuccess({
          userId: performedBy,
          action: AuditAction.RESOURCE_CREATED,
          resource: 'Permission',
          resourceId: permission.id,
          details: {
            permissionName: permission.name,
            resource: permission.resource,
            action: permission.action,
            batchOperation: true,
          },
          ipAddress,
          userAgent,
        });
        results.push(permission);
      }

      return {
        success: results,
        failed: [] as FailedPermission[],
        total: dtos.length,
        created: results.length,
      };
    } catch (error) {
      // Log the transaction error for debugging
      this.logger.error(
        `Batch permission creation transaction failed. Attempting individual creates.`,
        error instanceof Error ? error.stack : error,
      );
      
      // If transaction fails, try individual creates to identify which ones fail
      for (const dto of dtos) {
        try {
          const permission = await this.db.permission.create({
            data: {
              name: dto.name,
              resource: dto.resource,
              action: dto.action,
              description: dto.description,
            },
            include: {
              _count: {
                select: {
                  roles: true,
                },
              },
            },
          });

          await this.auditLog.logSuccess({
            userId: performedBy,
            action: AuditAction.RESOURCE_CREATED,
            resource: 'Permission',
            resourceId: permission.id,
            details: {
              permissionName: permission.name,
              resource: permission.resource,
              action: permission.action,
              batchOperation: true,
            },
            ipAddress,
            userAgent,
          });

          results.push(permission);
        } catch (individualError) {
          let errorMessage = 'Failed to create permission';
          
          if (individualError instanceof PrismaClientKnownRequestError) {
            if (individualError.code === 'P2002') {
              // Check which field caused the unique constraint violation
              const target = individualError.meta?.target;
              if (Array.isArray(target)) {
                if (target.includes('name')) {
                  errorMessage = `Permission name "${dto.name}" already exists`;
                } else if (target.includes('resource') && target.includes('action')) {
                  errorMessage = `Permission with resource "${dto.resource}" and action "${dto.action}" already exists`;
                } else {
                  errorMessage = 'Permission already exists (unique constraint violation)';
                }
              } else {
                errorMessage = 'Permission name already exists or resource-action combination already exists';
              }
            } else if (individualError.code === 'P2003') {
              errorMessage = 'Foreign key constraint violation';
            } else {
              errorMessage = `Database error: ${individualError.message}`;
            }
          } else if (individualError instanceof Error) {
            // Capture validation errors or other errors
            errorMessage = individualError.message || 'Failed to create permission';
          }
          
          this.logger.error(
            `Failed to create permission: ${dto.name} (${dto.resource}:${dto.action})`,
            individualError instanceof Error ? individualError.stack : individualError,
          );
          
          errors.push({
            permission: dto,
            error: errorMessage,
          });
        }
      }

      if (errors.length > 0 && results.length === 0) {
        // Create a detailed error message
        const errorDetails = errors.map((e, index) => ({
          index: index + 1,
          permission: {
            name: e.permission.name,
            resource: e.permission.resource,
            action: e.permission.action,
          },
          error: e.error,
        }));
        
        // Create summary message
        const uniqueErrors = [...new Set(errors.map(e => e.error))];
        const errorSummary = uniqueErrors.length <= 3 
          ? uniqueErrors.join(', ')
          : `${uniqueErrors.slice(0, 3).join(', ')} and ${uniqueErrors.length - 3} more error types`;
        
        const exception = new BadRequestException(
          `Failed to create any permissions: ${errorSummary}`,
        );
        
        // Attach detailed error information
        (exception as any).response = {
          message: `Failed to create any permissions: ${errorSummary}`,
          errors: errorDetails,
          total: dtos.length,
          failed: errors.length,
        };
        
        throw exception;
      }

      return {
        success: results,
        failed: errors,
        total: dtos.length,
        created: results.length,
        failedCount: errors.length,
      };
    }
  }

  async findAllPermissions(paginationDto?: PaginationDto) {
    if (paginationDto && (paginationDto.page !== undefined || paginationDto.limit !== undefined)) {
      const page = paginationDto.page ?? 1;
      const limit = paginationDto.limit ?? 10;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.db.permission.findMany({
          skip,
          take: limit,
          orderBy: { id: 'desc' },
          include: {
            _count: {
              select: {
                roles: true,
              },
            },
          },
        }),
        this.db.permission.count(),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    }

    const data = await this.db.permission.findMany({
      orderBy: { id: 'desc' },
      include: {
        _count: {
          select: {
            roles: true,
          },
        },
      },
    });

    return data;
  }

  async findOnePermission(id: number) {
    const permission = await this.db.permission.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        _count: {
          select: {
            roles: true,
          },
        },
      },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return permission;
  }

  async updatePermission(
    id: number,
    dto: UpdatePermissionDto,
    performedBy?: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.db.permission.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        resource: true,
        action: true,
        description: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Permission not found');
    }

    const data: {
      name?: string;
      resource?: string;
      action?: string;
      description?: string;
    } = {};
    const changes: any = {};

    if (dto.name !== undefined && dto.name !== existing.name) {
      data.name = dto.name;
      changes.name = { from: existing.name, to: dto.name };
    }

    if (dto.resource !== undefined && dto.resource !== existing.resource) {
      data.resource = dto.resource;
      changes.resource = { from: existing.resource, to: dto.resource };
    }

    if (dto.action !== undefined && dto.action !== existing.action) {
      data.action = dto.action;
      changes.action = { from: existing.action, to: dto.action };
    }

    if (dto.description !== undefined && dto.description !== existing.description) {
      data.description = dto.description;
      changes.description = { from: existing.description, to: dto.description };
    }

    if (Object.keys(data).length === 0) {
      return this.findOnePermission(id);
    }

    // Check for duplicate resource-action combination before updating
    if (data.resource !== undefined || data.action !== undefined) {
      const newResource = data.resource !== undefined ? data.resource : existing.resource;
      const newAction = data.action !== undefined ? data.action : existing.action;
      
      // Check if another permission (not this one) already has this combination
      const duplicatePermission = await this.db.permission.findFirst({
        where: {
          resource: newResource,
          action: newAction,
          id: { not: id }, // Exclude the current permission
        },
        select: {
          id: true,
          name: true,
        },
      });
      
      if (duplicatePermission) {
        throw new BadRequestException(
          `Permission with resource "${newResource}" and action "${newAction}" already exists (Permission ID: ${duplicatePermission.id}, Name: "${duplicatePermission.name}"). This combination is already in use.`,
        );
      }
    }

    // Check for duplicate name before updating
    if (data.name !== undefined) {
      const duplicateName = await this.db.permission.findFirst({
        where: {
          name: data.name,
          id: { not: id }, // Exclude the current permission
        },
        select: {
          id: true,
          resource: true,
          action: true,
        },
      });
      
      if (duplicateName) {
        throw new BadRequestException(
          `Permission name "${data.name}" already exists (Permission ID: ${duplicateName.id}, Resource: "${duplicateName.resource}", Action: "${duplicateName.action}"). Please choose a different name.`,
        );
      }
    }

    try {
      const updated = await this.db.permission.update({
        where: { id },
        data,
        include: {
          _count: {
            select: {
              roles: true,
            },
          },
        },
      });

      await this.auditLog.logSuccess({
        userId: performedBy,
        action: AuditAction.RESOURCE_UPDATED,
        resource: 'Permission',
        resourceId: id,
        details: { changes },
        ipAddress,
        userAgent,
      });

      return updated;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Check which field caused the unique constraint violation
          const target = error.meta?.target;
          const errorMessage = error.message || '';
          let errorMessageToReturn = 'Permission already exists';
          
          // Determine which constraint was violated based on error message and data being updated
          const isResourceActionConstraint = 
            errorMessage.includes('resource') && errorMessage.includes('action') ||
            (Array.isArray(target) && target.includes('resource') && target.includes('action')) ||
            (data.resource !== undefined || data.action !== undefined);
          
          const isNameConstraint = 
            errorMessage.includes('name') ||
            (Array.isArray(target) && target.includes('name')) ||
            data.name !== undefined;
          
          if (isResourceActionConstraint) {
            // Resource-action combination already exists
            const newResource = data.resource !== undefined ? data.resource : existing.resource;
            const newAction = data.action !== undefined ? data.action : existing.action;
            errorMessageToReturn = `Permission with resource "${newResource}" and action "${newAction}" already exists. This combination is already in use by another permission.`;
          } else if (isNameConstraint) {
            // Name already exists
            const newName = data.name || dto.name || existing.name;
            errorMessageToReturn = `Permission name "${newName}" already exists. Please choose a different name.`;
          } else {
            // Generic fallback - check what was being updated
            if (data.name !== undefined) {
              errorMessageToReturn = `Permission name "${data.name}" already exists. Please choose a different name.`;
            } else if (data.resource !== undefined || data.action !== undefined) {
              const newResource = data.resource !== undefined ? data.resource : existing.resource;
              const newAction = data.action !== undefined ? data.action : existing.action;
              errorMessageToReturn = `Permission with resource "${newResource}" and action "${newAction}" already exists. This combination is already in use by another permission.`;
            } else {
              errorMessageToReturn = 'Permission already exists. The name or resource-action combination conflicts with an existing permission.';
            }
          }
          
          this.logger.warn(
            `Unique constraint violation updating permission ${id}: ${errorMessageToReturn}`,
          );
          
          throw new BadRequestException(errorMessageToReturn);
        } else if (error.code === 'P2003') {
          throw new BadRequestException('Foreign key constraint violation');
        } else {
          this.logger.error(
            `Failed to update permission ${id}`,
            error instanceof Error ? error.stack : error,
          );
          throw new BadRequestException(`Database error: ${error.message}`);
        }
      }
      
      // Log unexpected errors
      this.logger.error(
        `Unexpected error updating permission ${id}`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async removePermission(
    id: number,
    performedBy?: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.db.permission.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            roles: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Permission not found');
    }

    const result = await this.db.permission.delete({
      where: { id },
    });

    await this.auditLog.logSuccess({
      userId: performedBy,
      action: AuditAction.RESOURCE_DELETED,
      resource: 'Permission',
      resourceId: id,
      details: {
        deletedPermission: {
          id: existing.id,
          name: existing.name,
          resource: existing.resource,
          action: existing.action,
        },
      },
      ipAddress,
      userAgent,
    });

    return result;
  }

  // ==================== User Permission Loading ====================

  /**
   * Get permissions for a user with full permission objects
   * Used by CASL AbilityFactory to build authorization abilities
   */
  async getUserPermissionsWithDetails(userId: number) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.role) {
      return [];
    }

    return user.role.permissions.map((rp) => rp.permission);
  }

  /**
   * Get all permissions for a user as strings (for frontend use)
   * Returns a flat array of permission strings in format: 'resource:action'
   * Also supports wildcard permissions like 'resource:*' or '*:*'
   */
  async getUserPermissions(userId: number): Promise<string[]> {
    const permissions = await this.getUserPermissionsWithDetails(userId);
    
    // Extract unique permissions from role
    const permissionStrings = permissions.map(
      (p) => `${p.resource}:${p.action}`,
    );

    // Remove duplicates
    return [...new Set(permissionStrings)];
  }
}

