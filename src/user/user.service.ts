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
import { EmailService } from '../email/email.service';
import * as crypto from 'crypto';

/**
 * ERROR HANDLING & LOGGING CHECKLIST ITEM #1:
 * Audit logging implemented for all user management operations
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: AuditLogService,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateUserDto, performedBy?: number, ipAddress?: string, userAgent?: string) {
    try {
      // Find or create the specified role
      let role = await this.db.role.findFirst({
        where: { name: dto.role },
      });

      if (!role) {
        role = await this.db.role.create({
          data: { name: dto.role },
        });
      }

      // Generate a temporary password hash if password is provided, otherwise generate a random one
      // For new users without password, we'll create them with a temporary password that must be changed
      const tempPassword = dto.password || crypto.randomBytes(32).toString('hex');
      const hash = await argon.hash(tempPassword);

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

      // If password was not provided, generate a password setup token and send email
      if (!dto.password) {
        // Generate secure random token
        const token = crypto.randomBytes(32).toString('hex');
        const hashedToken = await argon.hash(token);
        
        // Set token expiration (24 hours from now)
        const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Store token in OTP table (reusing OTP infrastructure)
        await this.db.otp.create({
          data: {
            userId: user.id,
            code: hashedToken,
            type: 'PASSWORD_RESET', // Reusing PASSWORD_RESET type for password setup
            expiresAt: tokenExpiresAt,
            isUsed: false,
          },
        });

        // Send password setup email
        try {
          await this.emailService.sendPasswordSetupEmail(dto.email, dto.name, token);
        } catch (error) {
          // If email fails, remove the token from database
          await this.db.otp.deleteMany({
            where: {
              userId: user.id,
              type: 'PASSWORD_RESET',
              expiresAt: { gte: new Date() },
            },
          });
          this.logger.error(`Failed to send password setup email to ${dto.email}:`, error);
          // Don't throw - user creation should still succeed even if email fails
        }
      }

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
          passwordSetupRequired: !dto.password,
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

      return result;
    }

    // Return all results if no pagination
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


