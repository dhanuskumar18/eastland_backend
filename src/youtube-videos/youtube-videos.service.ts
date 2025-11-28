import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateYouTubeVideoDto } from './dto/create-youtube-video.dto';
import { UpdateYouTubeVideoDto } from './dto/update-youtube-video.dto';
import { PaginationDto } from '../brand/dto/pagination.dto';
import { YouTubeVideoFilterDto } from './dto/filter.dto';

@Injectable()
export class YouTubeVideosService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateYouTubeVideoDto) {
    // Validate brand exists
    const brand = await this.db.brand.findUnique({ where: { id: dto.brandId } });
    if (!brand) throw new NotFoundException('Brand not found');

    // Validate category exists (can be VIDEO or PRODUCT type)
    const category = await this.db.category.findFirst({
      where: { id: dto.categoryId },
    });
    if (!category) throw new NotFoundException('Category not found');

    // Validate tags exist
    if (dto.tagIds && dto.tagIds.length > 0) {
      const tags = await this.db.tag.findMany({
        where: { id: { in: dto.tagIds } },
      });
      if (tags.length !== dto.tagIds.length) {
        throw new NotFoundException('One or more tags not found');
      }
    }

    // Validate YouTube link format
    if (!this.isValidYouTubeUrl(dto.youtubeLink)) {
      throw new BadRequestException('Invalid YouTube URL format');
    }

    const locale = dto.locale || 'en';

    // Create YouTube video with translation, brand, category, tags, and image
    const youtubeVideo = await this.db.youTubeVideo.create({
      data: {
        youtubeLink: dto.youtubeLink,
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
        images: {
          orderBy: { position: 'asc' },
        },
        translations: true,
      },
    });

    return this.formatYouTubeVideoResponse(youtubeVideo);
  }

  private formatYouTubeVideoResponse(video: any) {
    const translation = video.translations?.find((t: any) => t.locale === 'en') || video.translations?.[0];
    const firstCategory = video.categories?.[0];
    const firstImage = video.images?.[0];

    return {
      ...video,
      categoryId: firstCategory?.id,
      brandId: video.brandId || video.brand?.id,
      category: firstCategory ? { id: firstCategory.id, name: firstCategory.name } : null,
      name: translation?.name,
      title: translation?.name,
      imageUrl: firstImage?.url,
    };
  }

  async findAll(paginationDto?: PaginationDto, filterDto?: YouTubeVideoFilterDto) {
    // Build where clause for filtering
    const where: any = {};

    if (filterDto?.search) {
      const searchLower = filterDto.search.toLowerCase();
      where.translations = {
        some: {
          OR: [
            { name: { contains: searchLower, mode: 'insensitive' } },
            { description: { contains: searchLower, mode: 'insensitive' } },
          ],
        },
      };
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
        this.db.youTubeVideo.findMany({
          where,
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
        this.db.youTubeVideo.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        items: data.map((video: any) => this.formatYouTubeVideoResponse(video)),
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      };
    }

    const videos = await this.db.youTubeVideo.findMany({
      where,
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

    return videos.map((video: any) => this.formatYouTubeVideoResponse(video));
  }

  async findOne(id: number) {
    const youtubeVideo = await this.db.youTubeVideo.findUnique({
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

    if (!youtubeVideo) throw new NotFoundException('YouTube video not found');
    
    return this.formatYouTubeVideoResponse(youtubeVideo);
  }

  async update(id: number, dto: UpdateYouTubeVideoDto) {
    const existing = await this.db.youTubeVideo.findUnique({
      where: { id },
      include: { categories: true, tags: true },
    });

    if (!existing) throw new NotFoundException('YouTube video not found');

    // Validate brand if provided
    if (dto.brandId !== undefined) {
      const brand = await this.db.brand.findUnique({ where: { id: dto.brandId } });
      if (!brand) throw new NotFoundException('Brand not found');
    }

    // Validate category if provided
    if (dto.categoryId !== undefined) {
      const category = await this.db.category.findFirst({
        where: { id: dto.categoryId },
      });
      if (!category) throw new NotFoundException('Category not found');
    }

    // Validate YouTube link format if provided
    if (dto.youtubeLink && !this.isValidYouTubeUrl(dto.youtubeLink)) {
      throw new BadRequestException('Invalid YouTube URL format');
    }

    // Validate tags if provided (allow empty array to clear tags)
    if (dto.tagIds !== undefined && dto.tagIds.length > 0) {
      const tags = await this.db.tag.findMany({
        where: { id: { in: dto.tagIds } },
      });
      if (tags.length !== dto.tagIds.length) {
        throw new NotFoundException('One or more tags not found');
      }
    }

    const updateData: any = {};

    // Update YouTube link
    if (dto.youtubeLink !== undefined) {
      updateData.youtubeLink = dto.youtubeLink;
    }

    // Update brand
    if (dto.brandId !== undefined) {
      updateData.brand = { connect: { id: dto.brandId } };
    }

    // Update category (disconnect old, connect new - enforcing single category like products)
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

    // Update YouTube video first (for link, brand, category, tags)
    if (Object.keys(updateData).length > 0) {
      await this.db.youTubeVideo.update({
        where: { id },
        data: updateData,
      });
    }

    // Update translation (default locale 'en')
    const locale = 'en';
    const shouldUpdateTranslation = dto.name !== undefined || dto.description !== undefined;
    
    if (shouldUpdateTranslation) {
      const existingTranslation = await this.db.youTubeVideoTranslation.findUnique({
        where: { youtubeVideoId_locale: { youtubeVideoId: id, locale } },
      });

      const translationData: any = {};
      if (dto.name !== undefined) {
        translationData.name = dto.name;
      }
      if (dto.description !== undefined) {
        translationData.description = dto.description;
      }

      // Only update if we have data to update
      if (Object.keys(translationData).length > 0) {
        if (existingTranslation) {
          await this.db.youTubeVideoTranslation.update({
            where: { id: existingTranslation.id },
            data: translationData,
          });
        } else {
          // If no translation exists, create one
          await this.db.youTubeVideoTranslation.create({
            data: {
              youtubeVideoId: id,
              locale,
              name: dto.name !== undefined ? dto.name : '',
              description: dto.description !== undefined ? dto.description : '',
            },
          });
        }
      }
    }

    // Add new image if provided (ignore empty strings)
    if (dto.imageUrl && dto.imageUrl.trim() !== '') {
      const maxPosition = await this.db.youTubeVideoImage.findFirst({
        where: { youtubeVideoId: id },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      await this.db.youTubeVideoImage.create({
        data: {
          youtubeVideoId: id,
          url: dto.imageUrl,
          position: maxPosition?.position != null ? maxPosition.position + 1 : 0,
        },
      });
    }

    return this.findOne(id);
  }

  async remove(id: number) {
    const existing = await this.db.youTubeVideo.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('YouTube video not found');

    // Delete related records first (due to foreign key constraints)
    // Delete translations
    await this.db.youTubeVideoTranslation.deleteMany({
      where: { youtubeVideoId: id },
    });

    // Delete images
    await this.db.youTubeVideoImage.deleteMany({
      where: { youtubeVideoId: id },
    });

    // Delete the YouTube video (many-to-many relations will be handled automatically)
    return this.db.youTubeVideo.delete({ where: { id } });
  }

  private isValidYouTubeUrl(url: string): boolean {
    // Support various YouTube URL formats:
    // - https://www.youtube.com/watch?v=VIDEO_ID
    // - https://youtube.com/watch?v=VIDEO_ID
    // - http://www.youtube.com/watch?v=VIDEO_ID
    // - https://youtu.be/VIDEO_ID
    // - https://www.youtu.be/VIDEO_ID
    // - https://youtube.com/embed/VIDEO_ID
    // - https://www.youtube.com/embed/VIDEO_ID
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[\w-]+/;
    return youtubeRegex.test(url);
  }
}

