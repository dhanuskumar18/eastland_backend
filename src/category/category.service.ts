import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CategoryForDto, CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

type CategoryListItem = { id: number; name: string; for: CategoryForDto };

@Injectable()
export class CategoryService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateCategoryDto) {
    const type = this.mapForToType(dto.for);
    return (this.db as any).category.create({ data: { name: dto.name, type: type as any } as any });
  }

  async findAll(filterFor?: CategoryForDto): Promise<CategoryListItem[]> {
    const where = filterFor ? { type: this.mapForToType(filterFor) as any } : undefined;
    const rows = await (this.db as any).category.findMany({ where: where as any, orderBy: { id: 'desc' } });
    return rows
      .map((r: any) => ({ id: r.id, name: r.name, for: this.mapTypeToFor(r.type) }))
      .sort((a, b) => b.id - a.id);
  }

  async findOne(id: number, forType: CategoryForDto) {
    const type = this.mapForToType(forType);
    const row = await (this.db as any).category.findFirst({ where: { id, type: type as any } as any });
    if (!row) {
      if (forType === CategoryForDto.VIDEO) throw new NotFoundException('Video category not found');
      if (forType === CategoryForDto.PRODUCT) throw new NotFoundException('Product category not found');
      throw new NotFoundException('Category not found');
    }
    return row;
  }

  async update(id: number, dto: UpdateCategoryDto) {
    const existing = await (this.db as any).category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');

    const data: { name?: string; type?: any } = {};
    if (dto.name) {
      data.name = dto.name;
    }
    if (dto.for) {
      data.type = this.mapForToType(dto.for) as any; // allow changing type
    }

    if (Object.keys(data).length === 0) return existing;
    return (this.db as any).category.update({ where: { id }, data: data as any });
  }

  async remove(id: number, forType: CategoryForDto) {
    const type = this.mapForToType(forType);
    const exists = await (this.db as any).category.findFirst({ where: { id, type: type as any } as any, select: { id: true } });
    if (!exists) {
      if (forType === CategoryForDto.VIDEO) throw new NotFoundException('Video category not found');
      if (forType === CategoryForDto.PRODUCT) throw new NotFoundException('Product category not found');
      throw new NotFoundException('Category not found');
    }
    return (this.db as any).category.delete({ where: { id } });
  }

  private mapForToType(forValue: CategoryForDto) {
    if (forValue === CategoryForDto.VIDEO) return 'VIDEO';
    if (forValue === CategoryForDto.PRODUCT) return 'PRODUCT';
    throw new BadRequestException('Invalid category type');
  }

  private mapTypeToFor(type: any): CategoryForDto {
    if (type === 'VIDEO') return CategoryForDto.VIDEO;
    if (type === 'PRODUCT') return CategoryForDto.PRODUCT;
    throw new BadRequestException('Invalid category type');
  }
}


