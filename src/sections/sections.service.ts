import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateSectionDto, SectionTranslationInput } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { PaginationDto } from './dto/pagination.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SectionsService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateSectionDto) {
    const { name, pageId, translations } = dto;
    
    // Check if page exists
    const page = await this.db.page.findUnique({ where: { id: pageId }, select: { id: true } });
    if (!page) {
      throw new NotFoundException(`Page with id ${pageId} not found`);
    }

    try {
      return await this.db.section.create({
        data: {
          name,
          pageId,
          translations: translations && translations.length > 0 ? {
            create: translations.map((t) => ({ locale: t.locale, content: t.content }))
          } : undefined,
        },
        include: { translations: true },
      });
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

  async update(id: number, dto: UpdateSectionDto) {
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

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.ensureExists(id);
    return this.db.section.delete({ where: { id } });
  }

  private async ensureExists(id: number) {
    const exists = await this.db.section.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Section not found');
  }
}


