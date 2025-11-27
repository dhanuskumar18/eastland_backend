import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from '../brand/dto/pagination.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  
  constructor(
    private readonly db: DatabaseService,
  ) {}

  async create(dto: CreateProductDto) {
    // Validate brand, category, and tags in parallel
    const [brand, category, tags] = await Promise.all([
      this.db.brand.findUnique({ 
        where: { id: dto.brandId },
        select: { id: true }
      }),
      this.db.category.findFirst({
        where: { id: dto.categoryId, type: 'PRODUCT' },
        select: { id: true }
      }),
      dto.tagIds && dto.tagIds.length > 0 
        ? this.db.tag.findMany({
            where: { id: { in: dto.tagIds }, type: 'PRODUCT' },
            select: { id: true }
          })
        : Promise.resolve([]),
    ]);

    if (!brand) throw new NotFoundException('Brand not found');
    if (!category) throw new NotFoundException('Product category not found');
    if (dto.tagIds && dto.tagIds.length > 0 && tags.length !== dto.tagIds.length) {
      throw new NotFoundException('One or more tags not found');
    }

    // Generate SKU if not provided
    const sku = dto.sku || this.generateSKU(dto.name);
    
    // Check if SKU already exists
    const existingSku = await this.db.product.findUnique({ 
      where: { sku },
      select: { id: true }
    });
    if (existingSku) {
      throw new BadRequestException('SKU already exists. Please provide a unique SKU.');
    }

    // Generate slug from name
    const slug = this.slugify(dto.name);
    const locale = dto.locale || 'en';

    // Create product with translation, category, tags, and image
    const product = await this.db.product.create({
      data: {
        sku,
        brandId: dto.brandId,
        categories: {
          connect: { id: dto.categoryId },
        },
        tags: dto.tagIds && dto.tagIds.length > 0 ? {
          connect: dto.tagIds.map(id => ({ id })),
        } : undefined,
        translations: {
          create: {
            locale,
            name: dto.name,
            slug,
            description: dto.description,
          },
        },
        images: dto.imageUrl ? {
          create: {
            url: dto.imageUrl,
            position: 0,
          },
        } : undefined,
      },
      select: {
        id: true,
        sku: true,
        brandId: true,
        createdAt: true,
        updatedAt: true,
        brand: {
          select: { id: true, name: true, slug: true }
        },
        categories: {
          select: { id: true, name: true }
        },
        tags: {
          select: { id: true, name: true }
        },
        images: {
          select: { id: true, url: true, position: true },
        },
        translations: {
          select: { id: true, locale: true, name: true, slug: true, description: true }
        },
      },
    });

    return product;
  }

  async findAll(paginationDto?: PaginationDto) {
    if (paginationDto && (paginationDto.page !== undefined || paginationDto.limit !== undefined)) {
      const page = paginationDto.page ?? 1;
      const limit = paginationDto.limit ?? 10;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.db.product.findMany({
          skip,
          take: limit,
          orderBy: { id: 'desc' },
          select: {
            id: true,
            sku: true,
            brandId: true,
            createdAt: true,
            updatedAt: true,
            brand: {
              select: { id: true, name: true }
            },
            categories: {
              select: { id: true, name: true },
              take: 1, // Only first category for list view
            },
            tags: {
              select: { id: true, name: true },
              take: 3, // Limit tags for list view
            },
            images: {
              select: { id: true, url: true },
              orderBy: { position: 'asc' },
              take: 1, // Only get first image for list view
            },
            translations: {
              select: { id: true, name: true },
              where: { locale: 'en' },
              take: 1,
            },
          },
        }),
        this.db.product.count(),
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

      return result;
    }

    const data = await this.db.product.findMany({
      orderBy: { id: 'desc' },
      select: {
        id: true,
        sku: true,
        brandId: true,
        createdAt: true,
        updatedAt: true,
        brand: {
          select: { id: true, name: true, slug: true }
        },
        categories: {
          select: { id: true, name: true }
        },
        tags: {
          select: { id: true, name: true }
        },
        images: {
          select: { id: true, url: true, position: true },
          orderBy: { position: 'asc' },
          take: 1,
        },
        translations: {
          select: { id: true, locale: true, name: true, slug: true },
          where: { locale: 'en' },
          take: 1,
        },
      },
    });

    return data;
  }

  async findOne(id: number) {
    const product = await this.db.product.findUnique({
      where: { id },
      select: {
        id: true,
        sku: true,
        brandId: true,
        createdAt: true,
        updatedAt: true,
        brand: {
          select: { id: true, name: true, slug: true }
        },
        categories: {
          select: { id: true, name: true }
        },
        tags: {
          select: { id: true, name: true }
        },
        images: {
          select: { id: true, url: true, position: true },
          orderBy: { position: 'asc' },
        },
        translations: {
          select: { id: true, locale: true, name: true, slug: true, description: true }
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');
    
    return product;
  }

  async update(id: number, dto: UpdateProductDto) {
    const existing = await this.db.product.findUnique({
      where: { id },
      select: { 
        id: true, 
        categories: { select: { id: true } }, 
        tags: { select: { id: true } } 
      },
    });

    if (!existing) throw new NotFoundException('Product not found');

    // Validate brand, category, and tags in parallel (only if provided)
    const validations = await Promise.all([
      dto.brandId !== undefined 
        ? this.db.brand.findUnique({ 
            where: { id: dto.brandId },
            select: { id: true }
          })
        : Promise.resolve(true),
      dto.categoryId !== undefined
        ? this.db.category.findFirst({
            where: { id: dto.categoryId, type: 'PRODUCT' },
            select: { id: true }
          })
        : Promise.resolve(true),
      dto.tagIds !== undefined && dto.tagIds.length > 0
        ? this.db.tag.findMany({
            where: { id: { in: dto.tagIds }, type: 'PRODUCT' },
            select: { id: true }
          })
        : Promise.resolve([]),
    ]);

    const [brand, category, tags] = validations;

    if (dto.brandId !== undefined && !brand) throw new NotFoundException('Brand not found');
    if (dto.categoryId !== undefined && !category) throw new NotFoundException('Product category not found');
    if (dto.tagIds !== undefined && dto.tagIds.length > 0 && Array.isArray(tags) && tags.length !== dto.tagIds.length) {
      throw new NotFoundException('One or more tags not found');
    }

    const updateData: any = {};

    // Update brand
    if (dto.brandId !== undefined) {
      updateData.brand = { connect: { id: dto.brandId } };
    }

    // Update category (disconnect old, connect new - enforcing single category)
    if (dto.categoryId !== undefined) {
      updateData.categories = {
        set: [{ id: dto.categoryId }],
      };
    }

    // Update tags (allow empty array to clear all tags)
    if (dto.tagIds !== undefined) {
      updateData.tags = {
        set: dto.tagIds.map(id => ({ id })),
      };
    }

    // Update product first (for brand, category, tags)
    if (Object.keys(updateData).length > 0) {
      await this.db.product.update({
        where: { id },
        data: updateData,
      });
    }

    // Update translation (default locale 'en')
    const locale = 'en';
    const shouldUpdateTranslation = dto.name !== undefined || dto.description !== undefined;
    
    if (shouldUpdateTranslation) {
      const existingTranslation = await this.db.productTranslation.findUnique({
        where: { productId_locale: { productId: id, locale } },
      });

      const translationData: any = {};
      if (dto.name !== undefined) {
        translationData.name = dto.name;
        translationData.slug = this.slugify(dto.name);
      }
      if (dto.description !== undefined) {
        translationData.description = dto.description;
      }

      // Only update if we have data to update
      if (Object.keys(translationData).length > 0) {
        if (existingTranslation) {
          await this.db.productTranslation.update({
            where: { id: existingTranslation.id },
            data: translationData,
          });
        } else {
          // If no translation exists, create one
          await this.db.productTranslation.create({
            data: {
              productId: id,
              locale,
              name: dto.name !== undefined ? dto.name : '',
              slug: dto.name !== undefined ? this.slugify(dto.name) : '',
              description: dto.description !== undefined ? dto.description : '',
            },
          });
        }
      }
    }

    // Add new image if provided (ignore empty strings)
    if (dto.imageUrl && dto.imageUrl.trim() !== '') {
      const maxPosition = await this.db.productImage.findFirst({
        where: { productId: id },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      await this.db.productImage.create({
        data: {
          productId: id,
          url: dto.imageUrl,
          position: maxPosition?.position != null ? maxPosition.position + 1 : 0,
        },
      });
    }

    return this.findOne(id);
  }

  async remove(id: number) {
    const existing = await this.db.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('Product not found');

    // Delete related records first (due to foreign key constraints)
    // Delete translations
    await this.db.productTranslation.deleteMany({
      where: { productId: id },
    });

    // Delete images
    await this.db.productImage.deleteMany({
      where: { productId: id },
    });

    // Delete the product (many-to-many relations will be handled automatically)
    const result = await this.db.product.delete({ where: { id } });

    return result;
  }

  private generateSKU(name: string): string {
    const prefix = name
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .padEnd(3, 'X');
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${timestamp}`;
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

