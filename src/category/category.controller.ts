import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, BadRequestException, Req, Header, UseGuards } from '@nestjs/common';  
import type { Request } from 'express';
import { CategoryService } from './category.service';
import { CategoryForDto, CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PaginationDto } from './dto/pagination.dto';
import { SkipCsrf } from 'src/auth/csrf';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtGuard, PermissionsGuard } from 'src/auth/guard';
import { Permissions, GetUser } from 'src/auth/decorator';
import type { User } from '@prisma/client';

@SkipCsrf()
@SkipThrottle() // Skip throttling for public category listings
@Controller('categories')
export class CategoryController {
  constructor(private readonly service: CategoryService) {}
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('category:create')
  @Post()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  create(
    @Body() dto: CreateCategoryDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.service.create(
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
    @Query('for') forType?: CategoryForDto,
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
    return this.service.findAll(normalized, paginationDto);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('for') forType: CategoryForDto,
  ) {
    const normalized = this.normalizeForRequired(forType);
    return this.service.findOne(id, normalized);
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('category:update')
  @Patch(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.service.update(
      id,
      dto,
      user.id,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('category:delete')
  @Delete(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('for') forType: CategoryForDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    const normalized = this.normalizeForRequired(forType);
    return this.service.remove(
      id,
      normalized,
      user.id,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
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


