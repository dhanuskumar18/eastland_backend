import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { PaginationDto } from './dto/pagination.dto';

@Injectable()
export class PagesService {
  constructor(private readonly db: DatabaseService) {}

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

    // If pagination is not provided, return all sections
    const shouldPaginate = paginationDto && (paginationDto.page !== undefined || paginationDto.limit !== undefined);
    
    if (!shouldPaginate) {
      const sections = await this.db.section.findMany({
        where: { pageId: pageData.id },
        orderBy: { id: 'desc' },
        include: { translations: true },
      });

      return {
        ...pageData,
        sections: {
          data: sections,
          meta: {
            total: sections.length,
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

    return {
      ...pageData,
      sections: {
        data: sections,
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

    return {
      ...pageData,
      sections: {
        data: sections,
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
}


