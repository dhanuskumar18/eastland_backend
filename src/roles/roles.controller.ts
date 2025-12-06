import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { JwtGuard, RolesGuard, PermissionsGuard } from 'src/auth/guard';
import { GetUser, Roles, Permissions } from 'src/auth/decorator';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { CreatePermissionsBatchDto } from './dto/create-permissions-batch.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PaginationDto } from '../brand/dto/pagination.dto';
import { SkipCsrf } from 'src/auth/csrf';
import { UserRole } from '@prisma/client';
import { Throttle, SkipThrottle } from '@nestjs/throttler';

@SkipCsrf()
@Throttle({ medium: { limit: 100, ttl: 10000 } }) // 100 requests per 10 seconds for admin endpoints
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // ==================== Permission CRUD Endpoints (must come before :id routes) ====================

  @UseGuards(JwtGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN)
  @Permissions('permission:create')
  @Post('permissions')
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async createPermission(
    @Body() dto: CreatePermissionDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const data = await this.rolesService.createPermission(
      dto,
      user.id,
      req.ip,
      req.get('user-agent'),
    );
    return {
      version: '1',
      code: HttpStatus.CREATED,
      status: true,
      message: 'Permission created successfully',
      data,
    };
  }

  @UseGuards(JwtGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN)
  @Permissions('permission:create')
  @Post('permissions/batch')
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async createPermissionsBatch(
    @Body() dto: CreatePermissionsBatchDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const data = await this.rolesService.createPermissionsBatch(
      dto.permissions,
      user.id,
      req.ip,
      req.get('user-agent'),
    );
    return {
      version: '1',
      code: HttpStatus.CREATED,
      status: true,
      message: `Successfully created ${data.created} of ${data.total} permissions`,
      data,
    };
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @SkipThrottle()
  @Get('permissions/all')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findAllPermissions(
    @Query() paginationDto?: PaginationDto,
    @Req() req?: Request,
  ) {
    const hasPaginationParams =
      req?.query?.page !== undefined || req?.query?.limit !== undefined;
    return this.rolesService.findAllPermissions(
      hasPaginationParams ? paginationDto : undefined,
    );
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('permissions/:id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async findOnePermission(@Param('id', ParseIntPipe) id: number) {
    const data = await this.rolesService.findOnePermission(id);
    return {
      version: '1',
      code: HttpStatus.OK,
      status: true,
      message: 'OK',
      data,
    };
  }

  @UseGuards(JwtGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN)
  @Permissions('permission:update')
  @Patch('permissions/:id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async updatePermission(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePermissionDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const data = await this.rolesService.updatePermission(
      id,
      dto,
      user.id,
      req.ip,
      req.get('user-agent'),
    );
    return {
      version: '1',
      code: HttpStatus.OK,
      status: true,
      message: 'Permission updated successfully',
      data,
    };
  }

  @UseGuards(JwtGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN)
  @Permissions('permission:delete')
  @Delete('permissions/:id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async removePermission(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    await this.rolesService.removePermission(
      id,
      user.id,
      req.ip,
      req.get('user-agent'),
    );
    return {
      version: '1',
      code: HttpStatus.OK,
      status: true,
      message: 'Permission deleted successfully',
    };
  }

  // ==================== Role CRUD Endpoints ====================

  @UseGuards(JwtGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN)
  @Permissions('role:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async create(
    @Body() dto: CreateRoleDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const data = await this.rolesService.create(
      dto,
      user.id,
      req.ip,
      req.get('user-agent'),
    );
    return {
      version: '1',
      code: HttpStatus.CREATED,
      status: true,
      message: 'Role created successfully',
      data,
    };
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @SkipThrottle()
  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findAll(
    @Query() paginationDto?: PaginationDto,
    @Req() req?: Request,
  ) {
    const hasPaginationParams =
      req?.query?.page !== undefined || req?.query?.limit !== undefined;
    return this.rolesService.findAll(
      hasPaginationParams ? paginationDto : undefined,
    );
  }

  // ==================== Permission Assignment Endpoints ====================

  @UseGuards(JwtGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN)
  @Permissions('role:update')
  @Post(':id/permissions')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async assignPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPermissionsDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const data = await this.rolesService.assignPermissions(
      id,
      dto,
      user.id,
      req.ip,
      req.get('user-agent'),
    );
    return {
      version: '1',
      code: HttpStatus.OK,
      status: true,
      message: 'Permissions assigned successfully',
      data,
    };
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const data = await this.rolesService.findOne(id);
    return {
      version: '1',
      code: HttpStatus.OK,
      status: true,
      message: 'OK',
      data,
    };
  }

  @UseGuards(JwtGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN)
  @Permissions('role:update')
  @Patch(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const data = await this.rolesService.update(
      id,
      dto,
      user.id,
      req.ip,
      req.get('user-agent'),
    );
    return {
      version: '1',
      code: HttpStatus.OK,
      status: true,
      message: 'Role updated successfully',
      data,
    };
  }

  @UseGuards(JwtGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN)
  @Permissions('role:delete')
  @Delete(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    await this.rolesService.remove(id, user.id, req.ip, req.get('user-agent'));
    return {
      version: '1',
      code: HttpStatus.OK,
      status: true,
      message: 'Role deleted successfully',
    };
  }
}

