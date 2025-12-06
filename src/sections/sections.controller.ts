import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, Header, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { PaginationDto } from './dto/pagination.dto';
import { SkipCsrf } from 'src/auth/csrf';
import { JwtGuard, PermissionsGuard } from 'src/auth/guard';
import { Permissions, GetUser } from 'src/auth/decorator';
import type { User } from '@prisma/client';
// import { SkipThrottle } from '@nestjs/throttler';

@SkipCsrf()
@Controller('sections')
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('section:create')
  @Post()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  create(
    @Body() dto: CreateSectionDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.sectionsService.create(
      dto,
      user.id,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }

  // @SkipThrottle() - COMMENTED OUT FOR NOW
  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findAll(@Query() paginationDto: PaginationDto) {
    return this.sectionsService.findAll(paginationDto);
  }

  // @SkipThrottle() - COMMENTED OUT FOR NOW
  @Get(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sectionsService.findOne(id);
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('section:update')
  @Patch(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSectionDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.sectionsService.update(
      id,
      dto,
      user.id,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('section:delete')
  @Delete(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.sectionsService.remove(
      id,
      user.id,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }
}


