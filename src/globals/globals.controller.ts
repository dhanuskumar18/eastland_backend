import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { GlobalsService } from './globals.service';
import { CreateGlobalDto } from './dto/create-global.dto';
import { UpdateGlobalDto } from './dto/update-global.dto';
import { PaginationDto } from './dto/pagination.dto';

@Controller('globals')
export class GlobalsController {
  constructor(private readonly globalsService: GlobalsService) {}

  @Post()
  create(@Body() dto: CreateGlobalDto) {
    return this.globalsService.create(dto);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.globalsService.findAll(paginationDto);
  }

  @Get('name/:name')
  findByName(@Param('name') name: string) {
    return this.globalsService.findByName(name);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.globalsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGlobalDto) {
    return this.globalsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.globalsService.remove(id);
  }
}


