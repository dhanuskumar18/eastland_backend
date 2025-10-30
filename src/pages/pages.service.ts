import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';

@Injectable()
export class PagesService {
  constructor(private readonly db: DatabaseService) {}

  create(dto: CreatePageDto) {
    return this.db.page.create({ data: dto });
  }

  findAll() {
    return this.db.page.findMany({
      orderBy: { id: 'desc' },
      include: { sections: true },
    });
  }

  async findOne(id: number) {
    const page = await this.db.page.findUnique({
      where: { id },
      include: { sections: true },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
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


