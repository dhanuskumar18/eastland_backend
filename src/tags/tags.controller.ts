import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, BadRequestException, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TagsService } from './tags.service';
import { TagForDto, CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { PaginationDto } from './dto/pagination.dto';
import { SkipCsrf } from 'src/auth/csrf';
@SkipCsrf()
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  create(@Body() dto: CreateTagDto) {
    return this.tagsService.create(dto);
  }

  @Get()
  findAll(
    @Query('for') forType?: TagForDto,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Req() req?: Request,
  ) {
    const normalized = this.normalizeFor(forType);
    // Check if pagination query params were actually provided
    const hasPaginationParams = req?.query?.page !== undefined || req?.query?.limit !== undefined;
    const paginationDto: PaginationDto | undefined = hasPaginationParams
      ? {
          page: page ?? 1,
          limit: limit ?? 10,
        }
      : undefined;
    return this.tagsService.findAll(normalized, paginationDto);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('for') forType: TagForDto,
  ) {
    const normalized = this.normalizeForRequired(forType);
    return this.tagsService.findOne(id, normalized);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tagsService.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('for') forType: TagForDto,
  ) {
    const normalized = this.normalizeForRequired(forType);
    return this.tagsService.remove(id, normalized);
  }

  private normalizeFor(value?: string | TagForDto): TagForDto | undefined {
    if (!value) return undefined;
    const lower = String(value).toLowerCase();
    if (lower === TagForDto.VIDEO) return TagForDto.VIDEO;
    if (lower === TagForDto.PRODUCT) return TagForDto.PRODUCT;
    return undefined;
  }

  private normalizeForRequired(value?: string | TagForDto): TagForDto {
    const normalized = this.normalizeFor(value);
    if (!normalized) throw new BadRequestException('Query parameter "for" must be "video" or "product"');
    return normalized;
  }
}

