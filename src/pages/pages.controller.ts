import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, Req, Header } from '@nestjs/common';
import type { Request } from 'express';
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PaginationDto } from './dto/pagination.dto';
import { SkipCsrf } from 'src/auth/csrf';
import { SkipThrottle } from '@nestjs/throttler';

@SkipCsrf()
@SkipThrottle() // Skip throttling for all methods in this controller
@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Post()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  create(@Body() dto: CreatePageDto) {
    return this.pagesService.create(dto);
  }

  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findAll(@Query() paginationDto: PaginationDto) {
    return this.pagesService.findAll(paginationDto);
  }

  @Get('slug/:slug')
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
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.pagesService.remove(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePageDto) {
    return this.pagesService.update(id, dto);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.pagesService.findOne(id, paginationDto);
  }
}


