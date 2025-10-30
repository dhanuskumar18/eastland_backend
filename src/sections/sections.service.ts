import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateSectionDto, SectionTranslationInput } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

@Injectable()
export class SectionsService {
  constructor(private readonly db: DatabaseService) {}

  create(dto: CreateSectionDto) {
    const { name, pageId, translations } = dto;
    return this.db.section.create({
      data: {
        name,
        pageId,
        translations: translations && translations.length > 0 ? {
          create: translations.map((t) => ({ locale: t.locale, content: t.content }))
        } : undefined,
      },
      include: { translations: true },
    });
  }

  findAll() {
    return this.db.section.findMany({
      orderBy: { id: 'desc' },
      include: { translations: true, page: true },
    });
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
      // Upsert each translation by composite unique (sectionId, locale)
      await this.db.$transaction(
        translations.map((t: SectionTranslationInput) =>
          this.db.sectionTranslation.upsert({
            where: { sectionId_locale: { sectionId: id, locale: t.locale } },
            update: { content: t.content },
            create: { sectionId: id, locale: t.locale, content: t.content },
          })
        )
      );
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


