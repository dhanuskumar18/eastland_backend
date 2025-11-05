import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CategoryForDto, CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

type CategoryListItem = { id: number; name: string; slug: string; for: CategoryForDto };

@Injectable()
export class CategoryService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateCategoryDto) {
    const slug = this.slugify(dto.name);
    if (dto.for === CategoryForDto.VIDEO) {
      return this.db.videoCategory.create({ data: { name: dto.name, slug } });
    }
    if (dto.for === CategoryForDto.PRODUCT) {
      return this.db.productCategory.create({ data: { name: dto.name, slug } });
    }
    throw new BadRequestException('Invalid category type');
  }

  async findAll(filterFor?: CategoryForDto): Promise<CategoryListItem[]> {
    if (filterFor === CategoryForDto.VIDEO) {
      const rows = await this.db.videoCategory.findMany({ orderBy: { id: 'desc' } });
      return rows.map((r) => ({ ...r, for: CategoryForDto.VIDEO }));
    }
    if (filterFor === CategoryForDto.PRODUCT) {
      const rows = await this.db.productCategory.findMany({ orderBy: { id: 'desc' } });
      return rows.map((r) => ({ ...r, for: CategoryForDto.PRODUCT }));
    }
    const [videos, products] = await Promise.all([
      this.db.videoCategory.findMany({ orderBy: { id: 'desc' } }),
      this.db.productCategory.findMany({ orderBy: { id: 'desc' } }),
    ]);
    const list: CategoryListItem[] = [
      ...videos.map((r) => ({ ...r, for: CategoryForDto.VIDEO })),
      ...products.map((r) => ({ ...r, for: CategoryForDto.PRODUCT })),
    ];
    return list.sort((a, b) => b.id - a.id);
  }

  async findOne(id: number, forType: CategoryForDto) {
    if (forType === CategoryForDto.VIDEO) {
      const row = await this.db.videoCategory.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('Video category not found');
      return row;
    }
    if (forType === CategoryForDto.PRODUCT) {
      const row = await this.db.productCategory.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('Product category not found');
      return row;
    }
    throw new BadRequestException('Invalid category type');
  }

  async update(id: number, dto: UpdateCategoryDto) {
    if (!dto.for) throw new BadRequestException('Category "for" is required for update');
    const data: { name?: string; slug?: string } = {};
    if (dto.name) data.slug = this.slugify(dto.name), (data.name = dto.name);
    if (dto.for === CategoryForDto.VIDEO) {
      await this.ensureExists(id, CategoryForDto.VIDEO);
      return this.db.videoCategory.update({ where: { id }, data });
    }
    if (dto.for === CategoryForDto.PRODUCT) {
      await this.ensureExists(id, CategoryForDto.PRODUCT);
      return this.db.productCategory.update({ where: { id }, data });
    }
    throw new BadRequestException('Invalid category type');
  }

  async remove(id: number, forType: CategoryForDto) {
    if (forType === CategoryForDto.VIDEO) {
      await this.ensureExists(id, forType);
      return this.db.videoCategory.delete({ where: { id } });
    }
    if (forType === CategoryForDto.PRODUCT) {
      await this.ensureExists(id, forType);
      return this.db.productCategory.delete({ where: { id } });
    }
    throw new BadRequestException('Invalid category type');
  }

  private async ensureExists(id: number, forType: CategoryForDto) {
    if (forType === CategoryForDto.VIDEO) {
      const exists = await this.db.videoCategory.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new NotFoundException('Video category not found');
      return;
    }
    const exists = await this.db.productCategory.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Product category not found');
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
}


