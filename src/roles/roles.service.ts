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
          throw new BadRequestException('Role name already exists');
        }
      }
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
          throw new BadRequestException(
            'Permission name already exists or resource-action combination already exists',
          );
        }
      }
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
}

