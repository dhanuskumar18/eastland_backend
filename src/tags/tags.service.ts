import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { TagForDto, CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { PaginationDto } from './dto/pagination.dto';
import { AuditLogService, AuditAction } from '../common/services/audit-log.service';

// Temporary type until migration is run and Prisma generates the enum
type TagType = 'VIDEO' | 'PRODUCT';

type TagListItem = { id: number; name: string; type: TagType; for: TagForDto };
type TagWithType = { id: number; name: string; type: TagType };

@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(dto: CreateTagDto, performedBy?: number, ipAddress?: string, userAgent?: string) {
    const type = this.mapForToType(dto.for) as TagType;
    const tag = await this.db.tag.create({ 
      data: { 
        name: dto.name, 
        type: type as any
      } as any
    });

    // Audit log: Tag created
    await this.auditLog.logSuccess({
      userId: performedBy,
      action: AuditAction.RESOURCE_CREATED,
      resource: 'Tag',
      resourceId: tag.id,
      details: {
        name: dto.name,
        type: dto.for,
      },
      ipAddress,
      userAgent,
    });

    return tag;
  }

  async findAll(filterFor?: TagForDto, paginationDto?: PaginationDto) {
    const where = filterFor ? { type: this.mapForToType(filterFor) as any } : undefined;
    
    // If pagination is provided, return paginated results
    if (paginationDto && (paginationDto.page !== undefined || paginationDto.limit !== undefined)) {
      const page = paginationDto.page ?? 1;
      const limit = paginationDto.limit ?? 10;
      const skip = (page - 1) * limit;

      const [tags, total] = await Promise.all([
        this.db.tag.findMany({
          where: where as any,
          skip,
          take: limit,
          orderBy: { id: 'desc' },
          select: { id: true, name: true, type: true },
        }),
        this.db.tag.count({ where: where as any }),
      ]);

      const totalPages = Math.ceil(total / limit);

      const result = {
        data: tags.map((tag: any) => ({
          ...tag,
          for: this.mapTypeToFor(tag.type as TagType),
        })),
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

    const tags = await this.db.tag.findMany({
      where: where as any,
      orderBy: { id: 'desc' },
      select: { id: true, name: true, type: true },
    });
    
    const result = tags.map((tag: any) => ({
      ...tag,
      for: this.mapTypeToFor(tag.type as TagType),
    }));

    return result;
  }

  async findOne(id: number, forType: TagForDto) {
    const type = this.mapForToType(forType) as TagType;
    const tag = await this.db.tag.findFirst({
      where: { id, type: type as any } as any,
      select: { id: true, name: true, type: true },
    });
    if (!tag) throw new NotFoundException('Tag not found');
    return tag;
  }

  async update(id: number, dto: UpdateTagDto, performedBy?: number, ipAddress?: string, userAgent?: string) {
    // First, find the tag by id (regardless of type) to check if it exists
    const existingTag = await this.db.tag.findUnique({ 
      where: { id },
      select: { id: true, name: true }
    });
    if (!existingTag) throw new NotFoundException('Tag not found');
    
    // Build update payload from provided fields
    const data: any = {};
    if (dto.name) data.name = dto.name;
    
    // If dto.for is provided, update the type (allows changing tag type)
    if (dto.for) {
      data.type = this.mapForToType(dto.for) as TagType;
    }

    // Only update if there's something to update
    if (Object.keys(data).length === 0) {
      return existingTag;
    }

    const updated = await this.db.tag.update({ where: { id }, data });

    // Audit log: Tag updated
    await this.auditLog.logSuccess({
      userId: performedBy,
      action: AuditAction.RESOURCE_UPDATED,
      resource: 'Tag',
      resourceId: id,
      details: {
        changes: dto,
        oldName: existingTag.name,
      },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  async remove(id: number, forType: TagForDto, performedBy?: number, ipAddress?: string, userAgent?: string) {
    const type = this.mapForToType(forType);
    const existing = await this.db.tag.findFirst({ 
      where: { id, type: type as any } as any, 
      select: { id: true, name: true } 
    });
    if (!existing) throw new NotFoundException('Tag not found');
    
    const result = await this.db.tag.delete({ where: { id } });

    // Audit log: Tag deleted
    await this.auditLog.logSuccess({
      userId: performedBy,
      action: AuditAction.RESOURCE_DELETED,
      resource: 'Tag',
      resourceId: id,
      details: {
        name: existing.name,
        type: forType,
      },
      ipAddress,
      userAgent,
    });

    return result;
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
