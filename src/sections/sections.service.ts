import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateSectionDto, SectionTranslationInput } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { PaginationDto } from './dto/pagination.dto';
import { Prisma } from '@prisma/client';
import { AuditLogService, AuditAction } from '../common/services/audit-log.service';

@Injectable()
export class SectionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(dto: CreateSectionDto, performedBy?: number, ipAddress?: string, userAgent?: string) {
    const { name, pageId, translations } = dto;
    
    // Check if page exists
    const page = await this.db.page.findUnique({ where: { id: pageId }, select: { id: true } });
    if (!page) {
      throw new NotFoundException(`Page with id ${pageId} not found`);
    }

    try {
      const section = await this.db.section.create({
        data: {
          name,
          pageId,
          translations: translations && translations.length > 0 ? {
            create: translations.map((t) => ({ locale: t.locale, content: t.content }))
          } : undefined,
        },
        include: { translations: true },
      });

      // Audit log: Section created
      await this.auditLog.logSuccess({
        userId: performedBy,
        action: AuditAction.RESOURCE_CREATED,
        resource: 'Section',
        resourceId: section.id,
        details: {
          name,
          pageId,
        },
        ipAddress,
        userAgent,
      });

      return section;
    } catch (error) {
      // Handle Prisma unique constraint violations
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation
          const target = error.meta?.target as string[] | undefined;
          if (target?.includes('pageId') && target?.includes('name')) {
            throw new ConflictException(`A section with the name "${name}" already exists on this page`);
          }
          throw new ConflictException('A section with these values already exists');
        }
        if (error.code === 'P2003') {
          // Foreign key constraint violation
          throw new BadRequestException(`Invalid pageId: Page with id ${pageId} does not exist`);
        }
      }
      // Re-throw if it's not a handled Prisma error
      throw error;
    }
  }

  async findAll(paginationDto?: PaginationDto) {
    const page = paginationDto?.page ?? 1;
    const limit = paginationDto?.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.db.section.findMany({
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: { translations: true, page: true },
      }),
      this.db.section.count(),
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

  async findOne(id: number) {
    const section = await this.db.section.findUnique({
      where: { id },
      include: { translations: true, page: true },
    });
    if (!section) throw new NotFoundException('Section not found');
    return section;
  }

  async update(id: number, dto: UpdateSectionDto, performedBy?: number, ipAddress?: string, userAgent?: string) {
    await this.ensureExists(id);

    const { name, translations } = dto;

    const updated = await this.db.section.update({
      where: { id },
      data: { name },
      include: { translations: true },
    });

    if (translations && translations.length > 0) {
      // Normalize incoming translations: parse stringified JSON and drop entries without content
      const normalized = translations
        .map((t: SectionTranslationInput) => {
          let parsedContent = t.content as any;
          if (typeof parsedContent === 'string') {
            try {
              parsedContent = JSON.parse(parsedContent);
            } catch {
              // If parsing fails, keep as original string to surface a clear validation error below
            }
          }
          return { locale: t.locale, content: parsedContent } as SectionTranslationInput;
        })
        .filter((t) => typeof t.content !== 'undefined' && t.content !== null);

      if (normalized.length > 0) {
        // Upsert each translation by composite unique (sectionId, locale)
        await this.db.$transaction(
          normalized.map((t: SectionTranslationInput) =>
            this.db.sectionTranslation.upsert({
              where: { sectionId_locale: { sectionId: id, locale: t.locale } },
              update: { content: t.content },
              create: { sectionId: id, locale: t.locale, content: t.content },
            })
          )
        );
      }
    }

    const result = await this.findOne(id);

    // Audit log: Section updated
    await this.auditLog.logSuccess({
      userId: performedBy,
      action: AuditAction.RESOURCE_UPDATED,
      resource: 'Section',
      resourceId: id,
      details: {
        changes: dto,
      },
      ipAddress,
      userAgent,
    });

    return result;
  }

  async remove(id: number, performedBy?: number, ipAddress?: string, userAgent?: string) {
    const section = await this.ensureExists(id);
    const sectionData = await this.db.section.findUnique({ 
      where: { id }, 
      select: { id: true, name: true, pageId: true } 
    });
    
    await this.db.section.delete({ where: { id } });

    // Audit log: Section deleted
    await this.auditLog.logSuccess({
      userId: performedBy,
      action: AuditAction.RESOURCE_DELETED,
      resource: 'Section',
      resourceId: id,
      details: {
        name: sectionData?.name,
        pageId: sectionData?.pageId,
      },
      ipAddress,
      userAgent,
    });

    return { message: 'Section deleted successfully' };
  }

  /**
   * Remove inactive product from all sections
   * Called when a product becomes inactive
   */
  async removeInactiveProductFromSections(productId: number): Promise<void> {
    try {
      // Find all sections that might contain this product
      const sections = await this.db.section.findMany({
        include: { translations: true },
      });

      for (const section of sections) {
        let hasChanges = false;
        const updatedTranslations = section.translations.map((translation) => {
          const content = translation.content as any;
          if (!content || typeof content !== 'object') return translation;

          const updatedContent = { ...content };

          // Check if content has cards array (products section)
          if (Array.isArray(content.cards)) {
            const originalLength = content.cards.length;
            updatedContent.cards = content.cards.filter((card: any) => {
              // Remove card if it references the inactive product
              return card.productId !== productId && String(card.productId) !== String(productId);
            });
            if (updatedContent.cards.length !== originalLength) {
              hasChanges = true;
            }
          }

          if (hasChanges) {
            return {
              ...translation,
              content: updatedContent,
            };
          }
          return translation;
        });

        // Update section if changes were made
        if (hasChanges) {
          await this.db.$transaction(
            updatedTranslations
              .filter((t) => t !== section.translations.find((st) => st.id === t.id))
              .map((t) =>
                this.db.sectionTranslation.update({
                  where: { id: t.id },
                  data: { content: t.content },
                })
              )
          );
        }
      }
    } catch (error) {
      // Log error but don't throw - this is a cleanup operation
      console.error(`Error removing inactive product ${productId} from sections:`, error);
    }
  }

  /**
   * Remove inactive YouTube video from all sections
   * Called when a video becomes inactive
   */
  async removeInactiveVideoFromSections(videoId: number): Promise<void> {
    try {
      // Find all sections that might contain this video
      const sections = await this.db.section.findMany({
        include: { translations: true },
      });

      for (const section of sections) {
        let hasChanges = false;
        const updatedTranslations = section.translations.map((translation) => {
          const content = translation.content as any;
          if (!content || typeof content !== 'object') return translation;

          const updatedContent = { ...content };

          // Check if content has videos array (featured videos section)
          if (Array.isArray(content.videos)) {
            const originalLength = content.videos.length;
            updatedContent.videos = content.videos.filter((video: any) => {
              // Remove video if it references the inactive video
              return video.youtubeVideoId !== videoId && String(video.youtubeVideoId) !== String(videoId);
            });
            if (updatedContent.videos.length !== originalLength) {
              hasChanges = true;
            }
          }

          if (hasChanges) {
            return {
              ...translation,
              content: updatedContent,
            };
          }
          return translation;
        });

        // Update section if changes were made
        if (hasChanges) {
          await this.db.$transaction(
            updatedTranslations
              .filter((t) => {
                const original = section.translations.find((st) => st.id === t.id);
                return original && JSON.stringify(original.content) !== JSON.stringify(t.content);
              })
              .map((t) =>
                this.db.sectionTranslation.update({
                  where: { id: t.id },
                  data: { content: t.content },
                })
              )
          );
        }
      }
    } catch (error) {
      // Log error but don't throw - this is a cleanup operation
      console.error(`Error removing inactive video ${videoId} from sections:`, error);
    }
  }

  private async ensureExists(id: number) {
    const exists = await this.db.section.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Section not found');
    return exists;
  }
}


