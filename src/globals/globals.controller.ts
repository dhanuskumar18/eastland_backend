import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, Header, UseGuards } from '@nestjs/common';
import { GlobalsService } from './globals.service';
import { CreateGlobalDto } from './dto/create-global.dto';
import { UpdateGlobalDto } from './dto/update-global.dto';
import { PaginationDto } from './dto/pagination.dto';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtGuard, PermissionsGuard } from 'src/auth/guard';
import { Permissions } from 'src/auth/decorator';

@SkipThrottle() // Skip throttling for public global endpoints
@Controller('globals')
export class GlobalsController {
  constructor(private readonly globalsService: GlobalsService) {}

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('global:create')
  @Post()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  create(@Body() dto: CreateGlobalDto) {
    return this.globalsService.create(dto);
  }

  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findAll(@Query() paginationDto: PaginationDto) {
    return this.globalsService.findAll(paginationDto);
  }

  @Get('name/:name')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findByName(@Param('name') name: string) {
    return this.globalsService.findByName(name);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.globalsService.findOne(id);
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('global:update')
  @Patch(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGlobalDto) {
    return this.globalsService.update(id, dto);
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('global:delete')
  @Delete(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.globalsService.remove(id);
  }
}


