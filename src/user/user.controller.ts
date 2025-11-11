import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, Req, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { JwtGuard, RolesGuard } from 'src/auth/guard';
import { GetUser, Roles } from 'src/auth/decorator';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ToggleStatusDto } from './dto/toggle-status.dto';
import { PaginationDto } from '../brand/dto/pagination.dto';
import { SkipCsrf } from 'src/auth/csrf';
import { UserRole } from '@prisma/client';

@SkipCsrf()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtGuard)    
  @Get('me')
  getMe(@GetUser() user: User) {
    return user;
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
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
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  toggleStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: ToggleStatusDto) {
    return this.userService.toggleStatus(id, dto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }
}
