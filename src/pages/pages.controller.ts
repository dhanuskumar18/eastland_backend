import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PaginationDto } from './dto/pagination.dto';

@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Post()
  create(@Body() dto: CreatePageDto) {
    return this.pagesService.create(dto);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.pagesService.findAll(paginationDto);
  }

  @Get('slug/:slug')
  findBySlug(
    @Param('slug') slug: string,
    @Query() paginationDto: PaginationDto,
    @Req() req: Request,
  ) {
    // Check if pagination query params were actually provided
    const hasPaginationParams = req.query?.page !== undefined || req.query?.limit !== undefined;
    return this.pagesService.findBySlug(slug, hasPaginationParams ? paginationDto : undefined);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.pagesService.findOne(id, paginationDto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePageDto) {
    return this.pagesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.pagesService.remove(id);
  }
}


