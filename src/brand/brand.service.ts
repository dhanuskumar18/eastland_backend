import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { PaginationDto } from './dto/pagination.dto';

@Injectable()
export class BrandService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateBrandDto) {
    const slug = this.slugify(dto.name);
    return this.db.brand.create({ data: { name: dto.name, slug } });
  }

  async findAll(paginationDto?: PaginationDto) {
    // If pagination is provided, return paginated results
    if (paginationDto && (paginationDto.page !== undefined || paginationDto.limit !== undefined)) {
      const page = paginationDto.page ?? 1;
      const limit = paginationDto.limit ?? 10;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.db.brand.findMany({
          skip,
          take: limit,
          orderBy: { id: 'desc' },
        }),
        this.db.brand.count(),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    }

    // Return all results if no pagination
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


