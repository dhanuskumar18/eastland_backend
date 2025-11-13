import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { YouTubeVideosService } from './youtube-videos.service';
import { CreateYouTubeVideoDto } from './dto/create-youtube-video.dto';
import { UpdateYouTubeVideoDto } from './dto/update-youtube-video.dto';
import { PaginationDto } from '../brand/dto/pagination.dto';
import { SkipCsrf } from 'src/auth/csrf';

@SkipCsrf()
@Controller('youtube-videos')
export class YouTubeVideosController {
  constructor(private readonly youtubeVideosService: YouTubeVideosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateYouTubeVideoDto) {
    const data = await this.youtubeVideosService.create(dto);
    return {
      version: '1',
      code: HttpStatus.CREATED,
      status: true,
      message: 'YouTube video created successfully',
      data,
    };
  }

  @Get()
  async findAll(
    @Query() paginationDto?: PaginationDto,
    @Req() req?: Request,
  ) {
    const hasPaginationParams = req?.query?.page !== undefined || req?.query?.limit !== undefined;
    const result = await this.youtubeVideosService.findAll(hasPaginationParams ? paginationDto : undefined);
    
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
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateYouTubeVideoDto,
  ) {
    const data = await this.youtubeVideosService.update(id, dto);
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
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.youtubeVideosService.remove(id);
    return {
      version: '1',
      code: HttpStatus.OK,
      status: true,
      message: 'YouTube video deleted successfully',
      data: null,
    };
  }
}

