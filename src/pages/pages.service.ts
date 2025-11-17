import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PaginationDto } from './dto/pagination.dto';
import { YouTubeVideosService } from '../youtube-videos/youtube-videos.service';

@Injectable()
export class PagesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly youtubeVideosService: YouTubeVideosService,
  ) {}

  create(dto: CreatePageDto) {
    return this.db.page.create({ data: dto });
  }

  async findAll(paginationDto?: PaginationDto) {
    const page = paginationDto?.page ?? 1;
    const limit = paginationDto?.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.db.page.findMany({
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: { sections: true },
      }),
      this.db.page.count(),
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

  async findBySlug(slug: string, paginationDto?: PaginationDto) {
    const pageData = await this.db.page.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!pageData) throw new NotFoundException('Page not found');

    // Check if pagination was explicitly requested
    // If paginationDto is undefined/null or both page and limit are undefined, return all sections
    const hasPaginationParams = paginationDto && 
      (paginationDto.page !== undefined || paginationDto.limit !== undefined);
    
    if (!hasPaginationParams) {
      const sections = await this.db.section.findMany({
        where: { pageId: pageData.id },
        orderBy: { id: 'desc' },
        include: { translations: true },
      });

      // Enrich video sections with brand information
      const enrichedSections = await this.enrichVideoSections(sections);

      return {
        ...pageData,
        sections: {
          data: enrichedSections,
          meta: {
            total: enrichedSections.length,
          },
        },
      };
    }

    // Apply pagination if provided
    const page = paginationDto.page ?? 1;
    const limit = paginationDto.limit ?? 10;
    const skip = (page - 1) * limit;

    const [sections, totalSections] = await Promise.all([
      this.db.section.findMany({
        where: { pageId: pageData.id },
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: { translations: true },
      }),
      this.db.section.count({ where: { pageId: pageData.id } }),
    ]);

    const totalPages = Math.ceil(totalSections / limit);

    // Enrich video sections with brand information
    const enrichedSections = await this.enrichVideoSections(sections);

    return {
      ...pageData,
      sections: {
        data: enrichedSections,
        meta: {
          page,
          limit,
          total: totalSections,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    };
  }

  async findOne(id: number, paginationDto?: PaginationDto) {
    const page = paginationDto?.page ?? 1;
    const limit = paginationDto?.limit ?? 10;
    const skip = (page - 1) * limit;

    const pageData = await this.db.page.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!pageData) throw new NotFoundException('Page not found');

    const [sections, totalSections] = await Promise.all([
      this.db.section.findMany({
        where: { pageId: id },
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: { translations: true },
      }),
      this.db.section.count({ where: { pageId: id } }),
    ]);

    const totalPages = Math.ceil(totalSections / limit);

    // Enrich video sections with brand information
    const enrichedSections = await this.enrichVideoSections(sections);

    return {
      ...pageData,
      sections: {
        data: enrichedSections,
        meta: {
          page,
          limit,
          total: totalSections,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    };
  }

  async update(id: number, dto: UpdatePageDto) {
    await this.ensureExists(id);
    return this.db.page.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    // Sections and translations are cascaded via Prisma relation on delete
    return this.db.page.delete({ where: { id } });
  }

  private async ensureExists(id: number) {
    const exists = await this.db.page.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Page not found');
  }

  /**
   * Enrich video sections with brand information from YouTube videos
   */
  private async enrichVideoSections(sections: any[]): Promise<any[]> {
    const enrichedSections = await Promise.all(
      sections.map(async (section) => {
        // Only process video sections
        if (section.name !== 'video') {
          return section;
        }

        // Process each translation
        const enrichedTranslations = await Promise.all(
          (section.translations || []).map(async (translation: any) => {
            const content = translation.content || {};
            const videos = content.videos || [];

            // Enrich each video with brand information
            const enrichedVideos = await Promise.all(
              videos.map(async (video: any) => {
                // If video already has brand, skip
                if (video.brand || video.brandName) {
                  return video;
                }

                // If video has youtubeVideoId, fetch brand information
                if (video.youtubeVideoId) {
                  try {
                    const youtubeVideo = await this.youtubeVideosService.findOne(video.youtubeVideoId);
                    // Extract brand name from the response
                    // The brand can be an object with { id, name, slug } or just a name string
                    let brandName = '';
                    if (youtubeVideo?.brand) {
                      if (typeof youtubeVideo.brand === 'object' && youtubeVideo.brand.name) {
                        brandName = youtubeVideo.brand.name;
                      } else if (typeof youtubeVideo.brand === 'string') {
                        brandName = youtubeVideo.brand;
                      }
                    } else if (youtubeVideo?.brandName) {
                      brandName = youtubeVideo.brandName;
                    }
                    
                    if (brandName) {
                      return {
                        ...video,
                        brand: brandName,
                        brandName: brandName,
                      };
                    }
                  } catch (error) {
                    // If video not found or error, return original video
                    console.error(`Error fetching brand for video ${video.youtubeVideoId}:`, error);
                  }
                }

                return video;
              })
            );

            return {
              ...translation,
              content: {
                ...content,
                videos: enrichedVideos,
              },
            };
          })
        );

        return {
          ...section,
          translations: enrichedTranslations,
        };
      })
    );

    return enrichedSections;
  }
}


