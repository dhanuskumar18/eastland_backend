import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, Req, Header } from '@nestjs/common';
import type { Request } from 'express';
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PaginationDto } from './dto/pagination.dto';
import { SkipCsrf } from 'src/auth/csrf';
// import { SkipThrottle } from '@nestjs/throttler';

@SkipCsrf()
// @SkipThrottle() // Skip throttling for all methods in this controller - COMMENTED OUT FOR NOW
@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Post()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  create(@Body() dto: CreatePageDto, @Req() req: Request) {
    const userId = (req.user as any)?.id;
    return this.pagesService.create(
      dto,
      userId,
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

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const userId = (req.user as any)?.id;
    return this.pagesService.remove(
      id,
      userId,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePageDto, @Req() req: Request) {
    const userId = (req.user as any)?.id;
    return this.pagesService.update(
      id,
      dto,
      userId,
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


