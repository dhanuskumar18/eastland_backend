import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';
import { PaginationDto } from '../testimonials/dto/pagination.dto';
import { AuditLogService, AuditAction } from '../common/services/audit-log.service';

@Injectable()
export class ContactSubmissionsService {
  private readonly logger = new Logger(ContactSubmissionsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(dto: CreateContactSubmissionDto, performedBy?: number, ipAddress?: string, userAgent?: string) {
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

    // Audit log: Contact submission created (public submission, so performedBy may be null)
    await this.auditLog.logSuccess({
      userId: performedBy,
      action: AuditAction.RESOURCE_CREATED,
      resource: 'ContactSubmission',
      resourceId: submission.id,
      details: {
        name: dto.name,
        email: dto.email,
        subject: dto.subject,
      },
      ipAddress,
      userAgent,
    });

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
            isRead: true,
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

      return result;
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

  async remove(id: number, performedBy?: number, ipAddress?: string, userAgent?: string) {
    const existing = await this.db.contactSubmission.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, subject: true },
    });

    if (!existing) {
      throw new NotFoundException('Contact submission not found');
    }

    await this.db.contactSubmission.delete({ where: { id } });

    // Audit log: Contact submission deleted
    await this.auditLog.logSuccess({
      userId: performedBy,
      action: AuditAction.RESOURCE_DELETED,
      resource: 'ContactSubmission',
      resourceId: id,
      details: {
        name: existing.name,
        email: existing.email,
        subject: existing.subject,
      },
      ipAddress,
      userAgent,
    });

    return {
      status: true,
      code: 200,
      message: 'Contact submission deleted successfully',
    };
  }

  async getUnreadCount() {
    const count = await this.db.contactSubmission.count({
      where: { isRead: false },
    });

    const result = {
      status: true,
      code: 200,
      data: { count },
    };

    return result;
  }

  async getUnreadSubmissions(limit: number = 5) {
    const data = await this.db.contactSubmission.findMany({
      where: { isRead: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        subject: true,
        message: true,
        customFields: true,
        createdAt: true,
        isRead: true,
      },
    });

    const parsedData = data.map(item => ({
      ...item,
      customFields: this.parseCustomFields(item.customFields),
    }));

    const result = {
      status: true,
      code: 200,
      data: parsedData,
    };

    return result;
  }

  async markAsRead(id: number, performedBy?: number, ipAddress?: string, userAgent?: string) {
    const existing = await this.db.contactSubmission.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, subject: true },
    });

    if (!existing) {
      throw new NotFoundException('Contact submission not found');
    }

    await this.db.contactSubmission.update({
      where: { id },
      data: { isRead: true },
    });

    // Audit log: Contact submission marked as read
    await this.auditLog.logSuccess({
      userId: performedBy,
      action: AuditAction.RESOURCE_UPDATED,
      resource: 'ContactSubmission',
      resourceId: id,
      details: {
        action: 'marked_as_read',
        name: existing.name,
        email: existing.email,
      },
      ipAddress,
      userAgent,
    });

    return {
      status: true,
      code: 200,
      message: 'Contact submission marked as read',
    };
  }

  async markAllAsRead(performedBy?: number, ipAddress?: string, userAgent?: string) {
    const result = await this.db.contactSubmission.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });

    // Audit log: All contact submissions marked as read
    await this.auditLog.logSuccess({
      userId: performedBy,
      action: AuditAction.RESOURCE_UPDATED,
      resource: 'ContactSubmission',
      resourceId: undefined,
      details: {
        action: 'marked_all_as_read',
        count: result.count,
      },
      ipAddress,
      userAgent,
    });

    return {
      status: true,
      code: 200,
      message: 'All contact submissions marked as read',
    };
  }
}

