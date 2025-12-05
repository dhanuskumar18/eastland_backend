import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, BadRequestException, Req, Header } from '@nestjs/common';
import type { Request } from 'express';
import { TagsService } from './tags.service';
import { TagForDto, CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { PaginationDto } from './dto/pagination.dto';
import { SkipCsrf } from 'src/auth/csrf';
import { SkipThrottle } from '@nestjs/throttler';

@SkipCsrf()
@SkipThrottle() // Skip throttling for public tag listings
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  create(@Body() dto: CreateTagDto, @Req() req: Request) {
    const userId = (req.user as any)?.id;
    return this.tagsService.create(
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
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('for') forType: TagForDto,
  ) {
    const normalized = this.normalizeForRequired(forType);
    return this.tagsService.findOne(id, normalized);
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTagDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)?.id;
    return this.tagsService.update(
      id,
      dto,
      userId,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }

  @Delete(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('for') forType: TagForDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)?.id;
    const normalized = this.normalizeForRequired(forType);
    return this.tagsService.remove(
      id,
      normalized,
      userId,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
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

