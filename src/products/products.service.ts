import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from '../brand/dto/pagination.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateProductDto) {
    // Validate brand exists
    const brand = await this.db.brand.findUnique({ where: { id: dto.brandId } });
    if (!brand) throw new NotFoundException('Brand not found');

    // Validate category exists and is PRODUCT type
    const category = await this.db.category.findFirst({
      where: { id: dto.categoryId, type: 'PRODUCT' },
    });
    if (!category) throw new NotFoundException('Product category not found');

    // Validate tags exist and are PRODUCT type
    if (dto.tagIds && dto.tagIds.length > 0) {
      const tags = await this.db.tag.findMany({
        where: { id: { in: dto.tagIds }, type: 'PRODUCT' },
      });
      if (tags.length !== dto.tagIds.length) {
        throw new NotFoundException('One or more tags not found');
      }
    }

    // Generate SKU if not provided
    const sku = dto.sku || this.generateSKU(dto.name);
    
    // Check if SKU already exists
    const existingSku = await this.db.product.findUnique({ where: { sku } });
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
      include: {
        brand: true,
        categories: true,
        tags: true,
        images: true,
        translations: true,
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
          include: {
            brand: true,
            categories: true,
            tags: true,
            images: {
              orderBy: { position: 'asc' },
            },
            translations: {
              where: { locale: 'en' },
              take: 1,
            },
          },
        }),
        this.db.product.count(),
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

    return this.db.product.findMany({
      orderBy: { id: 'desc' },
      include: {
        brand: true,
        categories: true,
        tags: true,
        images: {
          orderBy: { position: 'asc' },
        },
        translations: {
          where: { locale: 'en' },
          take: 1,
        },
      },
    });
  }

  async findOne(id: number) {
    const product = await this.db.product.findUnique({
      where: { id },
      include: {
        brand: true,
        categories: true,
        tags: true,
        images: {
          orderBy: { position: 'asc' },
        },
        translations: true,
      },
    });

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: number, dto: UpdateProductDto) {
    // Debug: Log received DTO
    console.log('Update DTO received:', JSON.stringify(dto, null, 2));
    
    const existing = await this.db.product.findUnique({
      where: { id },
      include: { categories: true, tags: true },
    });

    if (!existing) throw new NotFoundException('Product not found');

    // Validate brand if provided
    if (dto.brandId !== undefined) {
      const brand = await this.db.brand.findUnique({ where: { id: dto.brandId } });
      if (!brand) throw new NotFoundException('Brand not found');
    }

    // Validate category if provided
    if (dto.categoryId !== undefined) {
      const category = await this.db.category.findFirst({
        where: { id: dto.categoryId, type: 'PRODUCT' },
      });
      if (!category) throw new NotFoundException('Product category not found');
    }

    // Validate tags if provided (allow empty array to clear tags)
    if (dto.tagIds !== undefined && dto.tagIds.length > 0) {
      const tags = await this.db.tag.findMany({
        where: { id: { in: dto.tagIds }, type: 'PRODUCT' },
      });
      if (tags.length !== dto.tagIds.length) {
        throw new NotFoundException('One or more tags not found');
      }
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
        console.log('Updating translation with data:', translationData);
        if (existingTranslation) {
          const updated = await this.db.productTranslation.update({
            where: { id: existingTranslation.id },
            data: translationData,
          });
          console.log('Translation updated:', updated);
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
    return this.db.product.delete({ where: { id } });
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

