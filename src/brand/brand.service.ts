import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateBrandDto) {
    const slug = this.slugify(dto.name);
    return this.db.brand.create({ data: { name: dto.name, slug } });
  }

  async findAll() {
    return this.db.brand.findMany({ orderBy: { id: 'desc' } });
  }

  async findOne(id: number) {
    const brand = await this.db.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async update(id: number, dto: UpdateBrandDto) {
    const existing = await this.db.brand.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Brand not found');

    const data: { name?: string; slug?: string } = {};
    if (dto.name) {
      data.name = dto.name;
      data.slug = this.slugify(dto.name);
    }

    if (Object.keys(data).length === 0) return existing;
    return this.db.brand.update({ where: { id }, data });
  }

  async remove(id: number) {
    const existing = await this.db.brand.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Brand not found');
    return this.db.brand.delete({ where: { id } });
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


