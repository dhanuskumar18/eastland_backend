import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, Req, Header, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PaginationDto } from './dto/pagination.dto';
import { SkipCsrf } from 'src/auth/csrf';
import { JwtGuard, PermissionsGuard } from 'src/auth/guard';
import { Permissions, GetUser } from 'src/auth/decorator';
import type { User } from '@prisma/client';
// import { SkipThrottle } from '@nestjs/throttler';

@SkipCsrf()
// @SkipThrottle() // Skip throttling for all methods in this controller - COMMENTED OUT FOR NOW
@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('page:create')
  @Post()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  create(
    @Body() dto: CreatePageDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.pagesService.create(
      dto,
      user.id,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }

  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findAll(@Query() paginationDto: PaginationDto, @Req() req: Request) {
    // Only enable pagination when page or limit query params are actually provided
    const hasPaginationParams = req.query?.page !== undefined || req.query?.limit !== undefined;
    return this.pagesService.findAll(hasPaginationParams ? paginationDto : undefined);
  }

  @Get('slug/:slug')
  // @SkipThrottle() // Ensure slug endpoint skips throttling - COMMENTED OUT FOR NOW
  findBySlug(
    @Param('slug') slug: string,
    @Query() paginationDto: PaginationDto,
    @Req() req: Request,
  ) {
    // Decode the slug in case it was URL encoded (e.g., team%2Fall -> team/all)
    const decodedSlug = decodeURIComponent(slug);
    
    // Check if pagination query params were actually provided
    const hasPaginationParams = req.query?.page !== undefined || req.query?.limit !== undefined;
    return this.pagesService.findBySlug(decodedSlug, hasPaginationParams ? paginationDto : undefined);
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('page:delete')
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.pagesService.remove(
      id,
      user.id,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('page:update')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePageDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.pagesService.update(
      id,
      dto,
      user.id,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.pagesService.findOne(id, paginationDto);
  }
}


