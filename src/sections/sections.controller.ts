import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { PaginationDto } from './dto/pagination.dto';
import { SkipCsrf } from 'src/auth/csrf';
import { SkipThrottle } from '@nestjs/throttler';

@SkipCsrf()
@Controller('sections')
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @SkipThrottle()
  @Post()
  create(@Body() dto: CreateSectionDto) {
    return this.sectionsService.create(dto);
  }

  @SkipThrottle()
  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.sectionsService.findAll(paginationDto);
  }

  @SkipThrottle()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sectionsService.findOne(id);
  }

  @SkipThrottle()
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSectionDto) {
    return this.sectionsService.update(id, dto);
  }

  @SkipThrottle()
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sectionsService.remove(id);
  }
}


