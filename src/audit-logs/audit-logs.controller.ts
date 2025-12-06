import { Controller, Get, Query, UseGuards, Header } from '@nestjs/common';
import { AuditLogService } from '../common/services/audit-log.service';
import { JwtGuard, PermissionsGuard } from '../auth/guard';
import { Permissions } from '../auth/decorator';
import { SkipCsrf } from '../auth/csrf';

@SkipCsrf()
@Controller('audit-logs')
@UseGuards(JwtGuard, PermissionsGuard)
export class AuditLogsController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Permissions('audit-log:read')
  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async getAuditLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offset = (pageNum - 1) * limitNum;

    const filters: any = {
      limit: limitNum,
      offset,
    };

    if (userId) filters.userId = parseInt(userId, 10);
    if (action) filters.action = action;
    if (resource) filters.resource = resource;
    if (status) filters.status = status;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const result = await this.auditLogService.query(filters);

    return {
      version: '1',
      code: 200,
      status: true,
      message: 'Audit logs retrieved successfully',
      validationErrors: [],
      data: result.data,
      meta: result.meta,
    };
  }
}

