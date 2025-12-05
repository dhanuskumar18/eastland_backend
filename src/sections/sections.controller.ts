import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, Header, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { PaginationDto } from './dto/pagination.dto';
import { SkipCsrf } from 'src/auth/csrf';
// import { SkipThrottle } from '@nestjs/throttler';

@SkipCsrf()
@Controller('sections')
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  // @SkipThrottle() - COMMENTED OUT FOR NOW
  @Post()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  create(@Body() dto: CreateSectionDto, @Req() req: Request) {
    const userId = (req.user as any)?.id;
    return this.sectionsService.create(
      dto,
      userId,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }

  // @SkipThrottle() - COMMENTED OUT FOR NOW
  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findAll(@Query() paginationDto: PaginationDto) {
    return this.sectionsService.findAll(paginationDto);
  }

  // @SkipThrottle() - COMMENTED OUT FOR NOW
  @Get(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sectionsService.findOne(id);
  }

  // @SkipThrottle() - COMMENTED OUT FOR NOW
  @Patch(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSectionDto, @Req() req: Request) {
    const userId = (req.user as any)?.id;
    return this.sectionsService.update(
      id,
      dto,
      userId,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }

  // @SkipThrottle() - COMMENTED OUT FOR NOW
  @Delete(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const userId = (req.user as any)?.id;
    return this.sectionsService.remove(
      id,
      userId,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }
}


