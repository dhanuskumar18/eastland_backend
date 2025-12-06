import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, BadRequestException, Req, Header, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { TagsService } from './tags.service';
import { TagForDto, CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { PaginationDto } from './dto/pagination.dto';
import { SkipCsrf } from 'src/auth/csrf';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtGuard, PermissionsGuard } from 'src/auth/guard';
import { Permissions, GetUser } from 'src/auth/decorator';
import type { User } from '@prisma/client';

@SkipCsrf()
@SkipThrottle() // Skip throttling for public tag listings
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('tag:create')
  @Post()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  create(
    @Body() dto: CreateTagDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.tagsService.create(
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

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('tag:update')
  @Patch(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTagDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.tagsService.update(
      id,
      dto,
      user.id,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('tag:delete')
  @Delete(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('for') forType: TagForDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const normalized = this.normalizeForRequired(forType);
    return this.tagsService.remove(
      id,
      normalized,
      user.id,
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

