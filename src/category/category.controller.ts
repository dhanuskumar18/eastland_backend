import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, BadRequestException } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryForDto, CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { SkipCsrf } from 'src/auth/csrf';
@SkipCsrf()

@Controller('categories')
export class CategoryController {
  constructor(private readonly service: CategoryService) {}
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query('for') forType?: CategoryForDto) {
    const normalized = this.normalizeFor(forType);
    return this.service.findAll(normalized);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('for') forType: CategoryForDto,
  ) {
    const normalized = this.normalizeForRequired(forType);
    return this.service.findOne(id, normalized);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('for') forType: CategoryForDto,
  ) {
    const normalized = this.normalizeForRequired(forType);
    return this.service.remove(id, normalized);
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


