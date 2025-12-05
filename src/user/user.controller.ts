import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, Req, UseGuards, HttpCode, HttpStatus, Header } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { JwtGuard, RolesGuard } from 'src/auth/guard';
import { GetUser, Roles } from 'src/auth/decorator';
import { UserService } from './user.service';
import { RolesService } from '../roles/roles.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ToggleStatusDto } from './dto/toggle-status.dto';
import { PaginationDto } from '../brand/dto/pagination.dto';
import { SkipCsrf } from 'src/auth/csrf';
import { UserRole } from '@prisma/client';
import { SkipThrottle } from '@nestjs/throttler';

@SkipCsrf()
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly rolesService: RolesService,
  ) {}

  @UseGuards(JwtGuard)    
  @Get('me')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async getMe(@GetUser() user: User) {
    return {
      version: '1',
      code: HttpStatus.OK,
      status: true,
      message: 'OK',
      data: user,
    };
  }

  @UseGuards(JwtGuard)
  @Get('me/permissions')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async getMyPermissions(@GetUser() user: User) {
    // Get permission strings for frontend
    const permissions = await this.rolesService.getUserPermissions(user.id);
    
    // Get role name from user object (role is included by JWT strategy)
    const roleName = (user as any).role?.name || null;
    
    return {
      version: '1',
      code: HttpStatus.OK,
      status: true,
      message: 'OK',
      data: {
        permissions, // Array of permission strings like ['user:create', 'user:read']
        role: roleName,
      },
    };
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async create(
    @Body() dto: CreateUserDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const data = await this.userService.create(
      dto,
      user.id,
      req.ip,
      req.get('user-agent'),
    );
    return {
      version: '1',
      code: HttpStatus.CREATED,
      status: true,
      message: 'User created successfully',
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
    // Check if pagination query params were actually provided
    const hasPaginationParams = req?.query?.page !== undefined || req?.query?.limit !== undefined;
    return this.userService.findAll(hasPaginationParams ? paginationDto : undefined);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const data = await this.userService.findOne(id);
    return {
      version: '1',
      code: HttpStatus.OK,
      status: true,
      message: 'OK',
      data,
    };
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async toggleStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToggleStatusDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const data = await this.userService.toggleStatus(
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
      message: 'User status updated successfully',
      data,
    };
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const data = await this.userService.update(
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
      message: 'User updated successfully',
      data,
    };
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.userService.remove(
      id,
      user.id,
      req.ip,
      req.get('user-agent'),
    );
  }
}
