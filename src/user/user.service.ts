import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ToggleStatusDto } from './dto/toggle-status.dto';
import { PaginationDto } from '../brand/dto/pagination.dto';
import * as argon from '@node-rs/argon2';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class UserService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateUserDto) {
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
          status: 'ACTIVE',
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

    // Return all results if no pagination
    return this.db.user.findMany({
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

  async update(id: number, dto: UpdateUserDto) {
    const existing = await this.db.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');

    const data: { name?: string; email?: string; roleId?: number } = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.email !== undefined) {
      data.email = dto.email;
    }

    if (dto.role !== undefined) {
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

  async toggleStatus(id: number, dto: ToggleStatusDto) {
    const existing = await this.db.user.findUnique({ where: { id } });
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

    return updated;
  }

  async remove(id: number) {
    const existing = await this.db.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('User not found');
    return this.db.user.delete({ where: { id } });
  }
}


