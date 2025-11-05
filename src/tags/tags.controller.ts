import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, BadRequestException } from '@nestjs/common';
import { TagsService } from './tags.service';
import { TagForDto, CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { SkipCsrf } from 'src/auth/csrf';
@SkipCsrf()
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  create(@Body() dto: CreateTagDto) {
    return this.tagsService.create(dto);
  }

  @Get()
  findAll(@Query('for') forType?: TagForDto) {
    const normalized = this.normalizeFor(forType);
    return this.tagsService.findAll(normalized);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('for') forType: TagForDto,
  ) {
    const normalized = this.normalizeForRequired(forType);
    return this.tagsService.findOne(id, normalized);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tagsService.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('for') forType: TagForDto,
  ) {
    const normalized = this.normalizeForRequired(forType);
    return this.tagsService.remove(id, normalized);
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

