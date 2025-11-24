import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';
import { PaginationDto } from '../testimonials/dto/pagination.dto';
import { CacheService } from '../common/cache/cache.service';

@Injectable()
export class ContactSubmissionsService {
  private readonly logger = new Logger(ContactSubmissionsService.name);
  private readonly CACHE_TTL = 180; // 3 minutes (contact submissions change frequently)

  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
  ) {}

  async create(dto: CreateContactSubmissionDto) {
    const submission = await this.db.contactSubmission.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        subject: dto.subject,
        message: dto.message,
        customFields: dto.customFields ? JSON.stringify(dto.customFields) : null,
      },
    });

    // Invalidate cache
    await this.cache.delPattern('contact-submissions:*');

    return {
      status: true,
      code: 200,
      message: 'Contact submission created successfully',
      data: submission,
    };
  }

  private parseCustomFields(customFields: string | null): Record<string, any> | null {
    if (!customFields) return null;
    try {
      return JSON.parse(customFields);
    } catch {
      return null;
    }
  }

  async findAll(paginationDto?: PaginationDto) {
    // If pagination is provided, return paginated results
    if (paginationDto && (paginationDto.page !== undefined || paginationDto.limit !== undefined)) {
      const page = paginationDto.page ?? 1;
      const limit = paginationDto.limit ?? 10;
      const skip = (page - 1) * limit;

      const cacheKey = `contact-submissions:paginated:${page}:${limit}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return cached;
      }

      const [data, total] = await Promise.all([
        this.db.contactSubmission.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            subject: true,
            message: true,
            customFields: true,
            createdAt: true,
          },
        }),
        this.db.contactSubmission.count(),
      ]);

      // Parse customFields for each submission
      const parsedData = data.map(item => ({
        ...item,
        customFields: this.parseCustomFields(item.customFields),
      }));

      const totalPages = Math.ceil(total / limit);

      const result = {
        status: true,
        code: 200,
        data: parsedData,
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };

      await this.cache.set(cacheKey, result, this.CACHE_TTL);
      return result;
    }

    // Return all results if no pagination
    const cacheKey = 'contact-submissions:all';
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    const data = await this.db.contactSubmission.findMany({ 
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        subject: true,
        message: true,
        customFields: true,
        createdAt: true,
      },
    });
    
    // Parse customFields for each submission
    const parsedData = data.map(item => ({
      ...item,
      customFields: this.parseCustomFields(item.customFields),
    }));

    const result = {
      status: true,
      code: 200,
      data: parsedData,
    };

    await this.cache.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  async findOne(id: number) {
    const submission = await this.db.contactSubmission.findUnique({ 
      where: { id } 
    });
    if (!submission) {
      throw new NotFoundException('Contact submission not found');
    }

    return {
      status: true,
      code: 200,
      data: {
        ...submission,
        customFields: this.parseCustomFields(submission.customFields),
      },
    };
  }

  async remove(id: number) {
    const existing = await this.db.contactSubmission.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Contact submission not found');
    }

    await this.db.contactSubmission.delete({ where: { id } });

    // Invalidate cache
    await this.cache.delPattern('contact-submissions:*');

    return {
      status: true,
      code: 200,
      message: 'Contact submission deleted successfully',
    };
  }
}

