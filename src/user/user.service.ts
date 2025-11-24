import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ToggleStatusDto } from './dto/toggle-status.dto';
import { PaginationDto } from '../brand/dto/pagination.dto';
import * as argon from '@node-rs/argon2';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { UserStatus } from '@prisma/client';
import { AuditLogService, AuditAction } from '../common/services/audit-log.service';
import { CacheService } from '../common/cache/cache.service';

/**
 * ERROR HANDLING & LOGGING CHECKLIST ITEM #1:
 * Audit logging implemented for all user management operations
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: AuditLogService,
    private readonly cache: CacheService,
  ) {}

  async create(dto: CreateUserDto, performedBy?: number, ipAddress?: string, userAgent?: string) {
    try {
      // Hash password
      const hash = await argon.hash(dto.password);

      // Find or create the specified role
      let role = await this.db.role.findFirst({
        where: { name: dto.role },
      });

      if (!role) {
        role = await this.db.role.create({
          data: { name: dto.role },
        });
      }

      const user = await this.db.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hash,
          roleId: role.id,
          status: dto.status || 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          role: {
            select: {
              name: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      });

      // Invalidate cache
      await this.cache.delPattern('users:*');

      // AUDIT LOG: User created
      await this.auditLog.logSuccess({
        userId: performedBy,
        action: AuditAction.USER_CREATED,
        resource: 'User',
        resourceId: user.id,
        details: {
          createdUser: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role.name,
            status: user.status,
          },
        },
        ipAddress,
        userAgent,
      });

      return user;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException('Email already exists');
        }
      }
      throw error;
    }
  }

  async findAll(paginationDto?: PaginationDto) {
    // If pagination is provided, return paginated results
    if (paginationDto && (paginationDto.page !== undefined || paginationDto.limit !== undefined)) {
      const page = paginationDto.page ?? 1;
      const limit = paginationDto.limit ?? 10;
      const skip = (page - 1) * limit;

      const cacheKey = `users:paginated:${page}:${limit}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return cached;
      }

      const [data, total] = await Promise.all([
        this.db.user.findMany({
          skip,
          take: limit,
          orderBy: { id: 'desc' },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            role: {
              select: {
                name: true,
              },
            },
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.db.user.count(),
      ]);

      const totalPages = Math.ceil(total / limit);

      const result = {
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

      await this.cache.set(cacheKey, result, this.CACHE_TTL);
      return result;
    }

    // Return all results if no pagination
    const cacheKey = 'users:all';
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    const data = await this.db.user.findMany({
      orderBy: { id: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        role: {
          select: {
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.cache.set(cacheKey, data, this.CACHE_TTL);
    return data;
  }

  async findOne(id: number) {
    const user = await this.db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        role: {
          select: {
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: number, dto: UpdateUserDto, performedBy?: number, ipAddress?: string, userAgent?: string) {
    const existing = await this.db.user.findUnique({ 
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        role: {
          select: {
            name: true,
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('User not found');

    const data: { name?: string; email?: string; roleId?: number; status?: UserStatus } = {};
    const changes: any = {};

    if (dto.name !== undefined && dto.name !== existing.name) {
      data.name = dto.name;
      changes.name = { from: existing.name, to: dto.name };
    }

    if (dto.email !== undefined && dto.email !== existing.email) {
      data.email = dto.email;
      changes.email = { from: existing.email, to: dto.email };
    }

    if (dto.status !== undefined && dto.status !== existing.status) {
      data.status = dto.status;
      changes.status = { from: existing.status, to: dto.status };
    }

    if (dto.role !== undefined && dto.role !== existing.role.name) {
      // Find or create the specified role
      let role = await this.db.role.findFirst({
        where: { name: dto.role },
      });

      if (!role) {
        role = await this.db.role.create({
          data: { name: dto.role },
        });
      }

      data.roleId = role.id;
      changes.role = { from: existing.role.name, to: dto.role };
    }

    if (Object.keys(data).length === 0) {
      return this.findOne(id);
    }

    try {
      const updated = await this.db.user.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          role: {
            select: {
              name: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      });

      // Invalidate cache
      await Promise.all([
        this.cache.del(`users:${id}`),
        this.cache.delPattern('users:paginated:*'),
        this.cache.del('users:all'),
      ]);

      // AUDIT LOG: User updated
      await this.auditLog.logSuccess({
        userId: performedBy,
        action: AuditAction.USER_UPDATED,
        resource: 'User',
        resourceId: id,
        details: { changes },
        ipAddress,
        userAgent,
      });

      // If role changed, log separate role change event
      if (changes.role) {
        await this.auditLog.logSuccess({
          userId: performedBy,
          action: AuditAction.USER_ROLE_CHANGED,
          resource: 'User',
          resourceId: id,
          details: {
            oldRole: changes.role.from,
            newRole: changes.role.to,
          },
          ipAddress,
          userAgent,
        });
      }

      return updated;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException('Email already exists');
        }
      }
      throw error;
    }
  }

  async toggleStatus(id: number, dto: ToggleStatusDto, performedBy?: number, ipAddress?: string, userAgent?: string) {
    const existing = await this.db.user.findUnique({ 
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
      },
    });
    if (!existing) throw new NotFoundException('User not found');

    const updated = await this.db.user.update({
      where: { id },
      data: { status: dto.status },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        role: {
          select: {
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    // Invalidate cache
    await Promise.all([
      this.cache.del(`users:${id}`),
      this.cache.delPattern('users:paginated:*'),
      this.cache.del('users:all'),
    ]);

    // AUDIT LOG: User status changed
    await this.auditLog.logSuccess({
      userId: performedBy,
      action: AuditAction.USER_STATUS_CHANGED,
      resource: 'User',
      resourceId: id,
      details: {
        oldStatus: existing.status,
        newStatus: dto.status,
        userEmail: existing.email,
        userName: existing.name,
      },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  async remove(id: number, performedBy?: number, ipAddress?: string, userAgent?: string) {
    const existing = await this.db.user.findUnique({ 
      where: { id }, 
      select: { 
        id: true,
        email: true,
        name: true,
        status: true,
        role: {
          select: {
            name: true,
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('User not found');

    const result = await this.db.user.delete({ where: { id } });

    // Invalidate cache
    await Promise.all([
      this.cache.del(`users:${id}`),
      this.cache.delPattern('users:paginated:*'),
      this.cache.del('users:all'),
    ]);

    // AUDIT LOG: User deleted
    await this.auditLog.logSuccess({
      userId: performedBy,
      action: AuditAction.USER_DELETED,
      resource: 'User',
      resourceId: id,
      details: {
        deletedUser: {
          id: existing.id,
          email: existing.email,
          name: existing.name,
          role: existing.role.name,
          status: existing.status,
        },
      },
      ipAddress,
      userAgent,
    });

    return result;
  }
}


