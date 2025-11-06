import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, BadRequestException, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CategoryService } from './category.service';
import { CategoryForDto, CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PaginationDto } from './dto/pagination.dto';
import { SkipCsrf } from 'src/auth/csrf';
@SkipCsrf()

@Controller('categories')
export class CategoryController {
  constructor(private readonly service: CategoryService) {}
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('for') forType?: CategoryForDto,
    @Query() paginationDto?: PaginationDto,
    @Req() req?: Request,
  ) {
    const normalized = this.normalizeFor(forType);
    // Check if pagination query params were actually provided
    const hasPaginationParams = req?.query?.page !== undefined || req?.query?.limit !== undefined;
    return this.service.findAll(normalized, hasPaginationParams ? paginationDto : undefined);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('for') forType: CategoryForDto,
  ) {
    const normalized = this.normalizeForRequired(forType);
    return this.service.findOne(id, normalized);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('for') forType: CategoryForDto,
  ) {
    const normalized = this.normalizeForRequired(forType);
    return this.service.remove(id, normalized);
  }

  private normalizeFor(value?: string | CategoryForDto): CategoryForDto | undefined {
    if (!value) return undefined;
    const lower = String(value).toLowerCase();
    if (lower === CategoryForDto.VIDEO) return CategoryForDto.VIDEO;
    if (lower === CategoryForDto.PRODUCT) return CategoryForDto.PRODUCT;
    return undefined;
  }

  private normalizeForRequired(value?: string | CategoryForDto): CategoryForDto {
    const normalized = this.normalizeFor(value);
    if (!normalized) throw new BadRequestException('Query parameter "for" must be "video" or "product"');
    return normalized;
  }
}


