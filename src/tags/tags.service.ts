import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { TagForDto, CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

// Temporary type until migration is run and Prisma generates the enum
type TagType = 'VIDEO' | 'PRODUCT';

type TagListItem = { id: number; name: string; type: TagType; for: TagForDto };
type TagWithType = { id: number; name: string; type: TagType };

@Injectable()
export class TagsService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateTagDto) {
    const type = this.mapForToType(dto.for) as TagType;
    return this.db.tag.create({ 
      data: { 
        name: dto.name, 
        type: type as any
      } as any
    });
  }

  async findAll(filterFor?: TagForDto): Promise<TagListItem[]> {
    const where = filterFor ? { type: this.mapForToType(filterFor) as any } : undefined;
    const tags = await this.db.tag.findMany({
      where: where as any,
      orderBy: { id: 'desc' },
    });
    return tags.map((tag: any) => ({
      ...tag,
      for: this.mapTypeToFor(tag.type as TagType),
    }));
  }

  async findOne(id: number, forType: TagForDto) {
    const type = this.mapForToType(forType) as TagType;
    const tag = await this.db.tag.findFirst({
      where: { id, type: type as any } as any,
    });
    if (!tag) throw new NotFoundException('Tag not found');
    return tag;
  }

  async update(id: number, dto: UpdateTagDto) {
    if (!dto || !dto.for) throw new BadRequestException('Tag "for" is required for update');
    const type = this.mapForToType(dto.for) as TagType;
    await this.ensureExists(id, type);
    
    const data: any = {};
    if (dto.name) data.name = dto.name;
    data.type = type;

    return this.db.tag.update({ where: { id }, data });
  }

  async remove(id: number, forType: TagForDto) {
    const type = this.mapForToType(forType);
    await this.ensureExists(id, type);
    return this.db.tag.delete({ where: { id } });
  }

  private async ensureExists(id: number, type: TagType) {
    const exists = await this.db.tag.findFirst({ 
      where: { id, type: type as any } as any, 
      select: { id: true } 
    });
    if (!exists) throw new NotFoundException('Tag not found');
  }

  private mapForToType(forValue: TagForDto): TagType {
    if (forValue === TagForDto.VIDEO) return 'VIDEO';
    if (forValue === TagForDto.PRODUCT) return 'PRODUCT';
    throw new BadRequestException('Invalid tag type');
  }

  private mapTypeToFor(type: TagType): TagForDto {
    if (type === 'VIDEO') return TagForDto.VIDEO;
    if (type === 'PRODUCT') return TagForDto.PRODUCT;
    throw new BadRequestException('Invalid tag type');
  }
}

