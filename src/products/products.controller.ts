import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Req,
  Header,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from '../brand/dto/pagination.dto';
import type { ProductFilterDto } from './dto/filter.dto';
import { SkipCsrf } from 'src/auth/csrf';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtGuard, PermissionsGuard } from 'src/auth/guard';
import { Permissions, GetUser } from 'src/auth/decorator';
import type { User } from '@prisma/client';

@SkipCsrf()
@SkipThrottle() // Skip throttling for public product listings
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('product:create')
  @Post()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async create(
    @Body() dto: CreateProductDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.productsService.create(
      dto,
      user.id,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }

  @Get()
  @SkipThrottle() // Ensure GET requests skip throttling
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findAll(@Req() req?: Request) {
    // Extract pagination parameters manually to avoid DTO validation conflicts
    const hasPaginationParams = req?.query?.page !== undefined || req?.query?.limit !== undefined;
    const paginationDto: PaginationDto | undefined = hasPaginationParams
      ? {
          page: req?.query?.page ? Number(req.query.page) : undefined,
          limit: req?.query?.limit ? Number(req.query.limit) : undefined,
        }
      : undefined;
    
    // Extract filter parameters manually to avoid DTO validation conflicts
    const isActiveParam = req?.query?.isActive;
    let isActive: boolean | undefined = undefined;
    if (isActiveParam !== undefined) {
      if (typeof isActiveParam === 'string') {
        isActive = isActiveParam === 'true';
      } else if (typeof isActiveParam === 'boolean') {
        isActive = isActiveParam;
      }
    }
    
    const filterDto: ProductFilterDto = {
      search: req?.query?.search as string | undefined,
      category: req?.query?.category as string | undefined,
      tag: req?.query?.tag as string | undefined,
      brand: req?.query?.brand as string | undefined,
      isActive,
    };
    
    return this.productsService.findAll(
      paginationDto,
      filterDto,
    );
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('product:update')
  @Patch(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.productsService.update(
      id,
      dto,
      user.id,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('product:delete')
  @Delete(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.productsService.remove(
      id,
      user.id,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }
}

