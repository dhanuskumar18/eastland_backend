import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateGlobalDto, GlobalTranslationInput } from './dto/create-global.dto';
import { UpdateGlobalDto } from './dto/update-global.dto';
import { PaginationDto } from './dto/pagination.dto';

@Injectable()
export class GlobalsService {
  constructor(private readonly db: DatabaseService) {}

  create(dto: CreateGlobalDto) {
    const { name, translations } = dto;
    return (this.db as any).globals.create({
      data: {
        name,
        translations: translations && translations.length > 0 ? {
          create: translations.map((t) => ({ locale: t.locale, content: t.content }))
        } : undefined,
      },
      include: { translations: true },
    });
  }

  async findAll(paginationDto?: PaginationDto) {
    const page = paginationDto?.page ?? 1;
    const limit = paginationDto?.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      (this.db as any).globals.findMany({
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: { translations: true },
      }),
      (this.db as any).globals.count(),
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
    const item = await (this.db as any).globals.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!item) throw new NotFoundException('Global not found');
    return item;
  }

  async findByName(name: string) {
    const item = await (this.db as any).globals.findFirst({
      where: { name },
      include: { translations: true },
      orderBy: { id: 'desc' },
    });
    if (!item) throw new NotFoundException('Global not found');
    return item;
  }

  async update(id: number, dto: UpdateGlobalDto) {
    await this.ensureExists(id);

    const { name, translations } = dto;

    await (this.db as any).globals.update({
      where: { id },
      data: { name },
    });

    if (translations && translations.length > 0) {
      const normalized = translations
        .map((t: GlobalTranslationInput) => {
          let parsedContent = t.content as any;
          if (typeof parsedContent === 'string') {
            try {
              parsedContent = JSON.parse(parsedContent);
            } catch {
            }
          }
          return { locale: t.locale, content: parsedContent } as GlobalTranslationInput;
        })
        .filter((t) => typeof t.content !== 'undefined' && t.content !== null);

      if (normalized.length > 0) {
        await (this.db as any).$transaction(
          normalized.map((t: GlobalTranslationInput) =>
            (this.db as any).globalsTranslation.upsert({
              where: { globalsId_locale: { globalsId: id, locale: t.locale } },
              update: { content: t.content },
              create: { globalsId: id, locale: t.locale, content: t.content },
            })
          )
        );
      }
    }

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.ensureExists(id);
    return (this.db as any).globals.delete({ where: { id } });
  }

  private async ensureExists(id: number) {
    const exists = await (this.db as any).globals.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Global not found');
  }
}


