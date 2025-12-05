import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from '../brand/dto/pagination.dto';
import { ProductFilterDto } from './dto/filter.dto';
import { AuditLogService, AuditAction } from '../common/services/audit-log.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(dto: CreateProductDto, performedBy?: number, ipAddress?: string, userAgent?: string) {
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

    // Audit log: Product created
    await this.auditLog.logSuccess({
      userId: performedBy,
      action: AuditAction.RESOURCE_CREATED,
      resource: 'Product',
      resourceId: product.id,
      details: {
        sku: product.sku,
        name: dto.name,
        brandId: product.brandId,
      },
      ipAddress,
      userAgent,
    });

    return product;
  }

  async findAll(paginationDto?: PaginationDto, filterDto?: ProductFilterDto) {
    // Build where clause for filtering
    const where: any = {};

    if (filterDto?.search) {
      const searchLower = filterDto.search.toLowerCase();
      where.OR = [
        { sku: { contains: searchLower, mode: 'insensitive' } },
        {
          translations: {
            some: {
              OR: [
                { name: { contains: searchLower, mode: 'insensitive' } },
                { description: { contains: searchLower, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    if (filterDto?.category) {
      where.categories = {
        some: {
          name: { equals: filterDto.category, mode: 'insensitive' },
        },
      };
    }

    if (filterDto?.tag) {
      where.tags = {
        some: {
          name: { equals: filterDto.tag, mode: 'insensitive' },
        },
      };
    }

    if (filterDto?.brand) {
      where.brand = {
        name: { equals: filterDto.brand, mode: 'insensitive' },
      };
    }

    if (paginationDto && (paginationDto.page !== undefined || paginationDto.limit !== undefined)) {
      const page = paginationDto.page ?? 1;
      const limit = paginationDto.limit ?? 10;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.db.product.findMany({
          where,
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
        this.db.product.count({ where }),
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
      where,
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

  async update(id: number, dto: UpdateProductDto, performedBy?: number, ipAddress?: string, userAgent?: string) {
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

    const updatedProduct = await this.findOne(id);
    
    // Audit log: Product updated
    await this.auditLog.logSuccess({
      userId: performedBy,
      action: AuditAction.RESOURCE_UPDATED,
      resource: 'Product',
      resourceId: id,
      details: {
        changes: dto,
      },
      ipAddress,
      userAgent,
    });

    return updatedProduct;
  }

  async remove(id: number, performedBy?: number, ipAddress?: string, userAgent?: string) {
    // Get product details BEFORE deleting (needed for matching in sections)
    const product = await this.db.product.findUnique({
      where: { id },
      select: {
        id: true,
        sku: true,
        images: {
          select: { url: true },
          orderBy: { position: 'asc' },
          take: 1,
        },
        translations: {
          select: { name: true, locale: true },
          where: { locale: 'en' },
          take: 1,
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');

    // Extract product image URL and name for fallback matching
    const productImageUrl = product.images?.[0]?.url || null;
    const productName = product.translations?.[0]?.name || null;

    // Remove product references from page sections BEFORE deleting the product
    await this.removeProductFromSections(id, productImageUrl, productName);

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

    // Audit log: Product deleted
    await this.auditLog.logSuccess({
      userId: performedBy,
      action: AuditAction.RESOURCE_DELETED,
      resource: 'Product',
      resourceId: id,
      details: {
        sku: product.sku,
        name: productName,
      },
      ipAddress,
      userAgent,
    });

    return result;
  }

  /**
   * Remove product references from all page sections
   * Uses productId as primary match, falls back to image URL or title if productId is missing
   */
  private async removeProductFromSections(productId: number, productImageUrl: string | null, productName: string | null) {
    try {
      this.logger.log(`Starting removal of product ${productId} from sections (image: ${productImageUrl}, name: ${productName})`);
      
      // Get all section translations
      const translations = await this.db.sectionTranslation.findMany({
        select: { id: true, content: true },
      });

      this.logger.log(`Found ${translations.length} section translations to check`);

      let totalRemoved = 0;
      // Process each translation
      for (const translation of translations) {
        const content = translation.content as any;
        let updated = false;

        // Check if content has cards array (products section)
        if (content?.cards && Array.isArray(content.cards)) {
          const originalLength = content.cards.length;
          
          // Remove cards that reference this product
          // Primary match: productId
          // Fallback match: image URL or title (for legacy cards without productId)
          content.cards = content.cards.filter(
            (card: any) => {
              const cardProductId = card?.productId;
              const cardImage = card?.image;
              const cardTitle = card?.title;
              
              // Primary match: Check by productId
              if (cardProductId != null && cardProductId !== undefined) {
                const matchesById = String(cardProductId) === String(productId) || 
                                  Number(cardProductId) === Number(productId);
                if (matchesById) {
                  this.logger.log(`Removing card with productId ${cardProductId} (matches ${productId})`);
                  return false; // Remove this card
                }
                return true; // Keep this card (different productId)
              }
              
              // Fallback match: Check by image URL (for legacy cards without productId)
              if (productImageUrl && cardImage) {
                const imageMatches = cardImage === productImageUrl || 
                                   cardImage.includes(productImageUrl.split('/').pop() || '') ||
                                   productImageUrl.includes(cardImage.split('/').pop() || '');
                if (imageMatches) {
                  this.logger.log(`Removing card with matching image URL: ${cardImage}`);
                  return false; // Remove this card
                }
              }
              
              // Fallback match: Check by title/name (for legacy cards without productId)
              if (productName && cardTitle) {
                const nameMatches = cardTitle.toLowerCase().trim() === productName.toLowerCase().trim();
                if (nameMatches) {
                  this.logger.log(`Removing card with matching title: ${cardTitle}`);
                  return false; // Remove this card
                }
              }
              
              // Keep card if no matches found
              return true;
            },
          );
          
          if (content.cards.length !== originalLength) {
            updated = true;
            totalRemoved += (originalLength - content.cards.length);
            this.logger.log(`Translation ${translation.id}: Removed ${originalLength - content.cards.length} card(s)`);
          }
        }

        // Update translation if changes were made
        if (updated) {
          await this.db.sectionTranslation.update({
            where: { id: translation.id },
            data: { content: content },
          });
          this.logger.log(`Translation ${translation.id}: Updated successfully`);
        }
      }
      
      this.logger.log(`Completed: Removed product ${productId} from ${totalRemoved} card(s) across all sections`);
    } catch (error) {
      // Log error but don't fail the deletion
      this.logger.error(`Error removing product ${productId} from sections:`, error);
    }
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

