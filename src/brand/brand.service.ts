import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { PaginationDto } from './dto/pagination.dto';
import { CacheService } from '../common/cache/cache.service';

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);
  private readonly CACHE_TTL = 600; // 10 minutes (brands change less frequently)

  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
  ) {}

  async create(dto: CreateBrandDto) {
    const slug = this.slugify(dto.name);
    const brand = await this.db.brand.create({ data: { name: dto.name, slug } });
    
    // Invalidate cache
    await this.cache.delPattern('brands:*');
    
    return brand;
  }

  async findAll(paginationDto?: PaginationDto) {
    // If pagination is provided, return paginated results
    if (paginationDto && (paginationDto.page !== undefined || paginationDto.limit !== undefined)) {
      const page = paginationDto.page ?? 1;
      const limit = paginationDto.limit ?? 10;
      const skip = (page - 1) * limit;

      const cacheKey = `brands:paginated:${page}:${limit}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return cached;
      }

      const [data, total] = await Promise.all([
        this.db.brand.findMany({
          skip,
          take: limit,
          orderBy: { id: 'desc' },
          select: { id: true, name: true, slug: true },
        }),
        this.db.brand.count(),
      ]);

      const totalPages = Math.ceil(total / limit);

      const result = {
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

      await this.cache.set(cacheKey, result, this.CACHE_TTL);
      return result;
    }

    // Return all results if no pagination
    const cacheKey = 'brands:all';
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    const data = await this.db.brand.findMany({ 
      orderBy: { id: 'desc' },
      select: { id: true, name: true, slug: true },
    });

    await this.cache.set(cacheKey, data, this.CACHE_TTL);
    return data;
  }

  async findOne(id: number) {
    const cacheKey = `brands:${id}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    const brand = await this.db.brand.findUnique({ 
      where: { id },
      select: { id: true, name: true, slug: true },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    
    await this.cache.set(cacheKey, brand, this.CACHE_TTL);
    return brand;
  }

  async update(id: number, dto: UpdateBrandDto) {
    const existing = await this.db.brand.findUnique({ 
      where: { id },
      select: { id: true }
    });
    if (!existing) throw new NotFoundException('Brand not found');

    const data: { name?: string; slug?: string } = {};
    if (dto.name) {
      data.name = dto.name;
      data.slug = this.slugify(dto.name);
    }

    if (Object.keys(data).length === 0) return this.findOne(id);
    
    const updated = await this.db.brand.update({ where: { id }, data });
    
    // Invalidate cache
    await Promise.all([
      this.cache.del(`brands:${id}`),
      this.cache.delPattern('brands:paginated:*'),
      this.cache.del('brands:all'),
    ]);
    
    return updated;
  }

  async remove(id: number) {
    const existing = await this.db.brand.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Brand not found');
    
    const result = await this.db.brand.delete({ where: { id } });
    
    // Invalidate cache
    await Promise.all([
      this.cache.del(`brands:${id}`),
      this.cache.delPattern('brands:paginated:*'),
      this.cache.del('brands:all'),
    ]);
    
    return result;
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


