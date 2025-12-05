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
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import type { Request } from 'express';
import { YouTubeVideosService } from './youtube-videos.service';
import { CreateYouTubeVideoDto } from './dto/create-youtube-video.dto';
import { UpdateYouTubeVideoDto } from './dto/update-youtube-video.dto';
import { PaginationDto } from '../brand/dto/pagination.dto';
import type { YouTubeVideoFilterDto } from './dto/filter.dto';
import { SkipCsrf } from 'src/auth/csrf';
import { SkipThrottle } from '@nestjs/throttler';

@SkipCsrf()
@SkipThrottle() // Skip throttling for public video listings
@Controller('youtube-videos')
export class YouTubeVideosController {
  constructor(private readonly youtubeVideosService: YouTubeVideosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async create(@Body() dto: CreateYouTubeVideoDto, @Req() req: Request) {
    const userId = (req.user as any)?.id;
    const data = await this.youtubeVideosService.create(
      dto,
      userId,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
    return {
      version: '1',
      code: HttpStatus.CREATED,
      status: true,
      message: 'YouTube video created successfully',
      data,
    };
  }

  @Get()
  @SkipThrottle() // Ensure GET requests skip throttling
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async findAll(@Req() req?: Request) {
    // Extract pagination parameters manually to avoid DTO validation conflicts
    const hasPaginationParams = req?.query?.page !== undefined || req?.query?.limit !== undefined;
    const paginationDto: PaginationDto | undefined = hasPaginationParams
      ? {
          page: req?.query?.page ? Number(req.query.page) : undefined,
          limit: req?.query?.limit ? Number(req.query.limit) : undefined,
        }
      : undefined;
    
    // Extract filter parameters manually to avoid DTO validation conflicts
    const filterDto: YouTubeVideoFilterDto = {
      search: req?.query?.search as string | undefined,
      category: req?.query?.category as string | undefined,
      tag: req?.query?.tag as string | undefined,
      brand: req?.query?.brand as string | undefined,
    };
    
    const result = await this.youtubeVideosService.findAll(
      paginationDto,
      filterDto,
    );
    
    // Check if result has 'items' property (paginated response)
    if (hasPaginationParams && 'items' in result) {
      return {
        version: '1',
        code: HttpStatus.OK,
        status: true,
        message: 'OK',
        data: result,
      };
    }
    
    return {
      version: '1',
      code: HttpStatus.OK,
      status: true,
      message: 'OK',
      data: result,
    };
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const data = await this.youtubeVideosService.findOne(id);
    return {
      version: '1',
      code: HttpStatus.OK,
      status: true,
      message: 'OK',
      data,
    };
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateYouTubeVideoDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)?.id;
    const data = await this.youtubeVideosService.update(
      id,
      dto,
      userId,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
    return {
      version: '1',
      code: HttpStatus.OK,
      status: true,
      message: 'YouTube video updated successfully',
      data,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const userId = (req.user as any)?.id;
    await this.youtubeVideosService.remove(
      id,
      userId,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
    return {
      version: '1',
      code: HttpStatus.OK,
      status: true,
      message: 'YouTube video deleted successfully',
      data: null,
    };
  }
}

