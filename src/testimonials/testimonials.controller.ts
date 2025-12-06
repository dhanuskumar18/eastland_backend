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
import { TestimonialsService } from './testimonials.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';
import { PaginationDto } from './dto/pagination.dto';
import type { TestimonialFilterDto } from './dto/filter.dto';
import { SkipCsrf } from 'src/auth/csrf';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtGuard, PermissionsGuard } from 'src/auth/guard';
import { Permissions, GetUser } from 'src/auth/decorator';
import type { User } from '@prisma/client';

@SkipCsrf()
@SkipThrottle() // Skip throttling for public testimonial listings
@Controller('testimonials')
export class TestimonialsController {
  constructor(
    private readonly testimonialsService: TestimonialsService,
  ) {}

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('testimonial:create')
  @Post()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async create(
    @Body() dto: CreateTestimonialDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.testimonialsService.create(
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
    const filterDto: TestimonialFilterDto = {
      search: req?.query?.search as string | undefined,
    };
    
    return this.testimonialsService.findAll(
      paginationDto,
      filterDto,
    );
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.testimonialsService.findOne(id);
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('testimonial:update')
  @Patch(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTestimonialDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.testimonialsService.update(
      id,
      dto,
      user.id,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('testimonial:delete')
  @Delete(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.testimonialsService.remove(
      id,
      user.id,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }
}
