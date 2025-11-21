import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { LogSanitizer } from '../utils/log-sanitizer.util';

/**
 * Audit Log Service
 * 
 * ERROR HANDLING & LOGGING CHECKLIST ITEMS #1, #3, #4, #5:
 * - Tracks all key administrative actions
 * - Logs important security events
 * - Includes useful context (user ID, IP, timestamp, action)
 * - Logs authentication decisions
 * 
 * Security Features:
 * 1. Comprehensive audit trail for compliance
 * 2. Sanitized logs (no sensitive data)
 * 3. Immutable audit records
 * 4. Searchable and filterable
 */

export enum AuditAction {
  // Authentication Events
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGIN_LOCKED = 'LOGIN_LOCKED',
  LOGOUT = 'LOGOUT',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  MFA_VERIFY_SUCCESS = 'MFA_VERIFY_SUCCESS',
  MFA_VERIFY_FAILURE = 'MFA_VERIFY_FAILURE',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  EMAIL_CHANGED = 'EMAIL_CHANGED',

  // User Management Events
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_STATUS_CHANGED = 'USER_STATUS_CHANGED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  PROFILE_UPDATED = 'PROFILE_UPDATED',

  // Session Events
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  ALL_SESSIONS_REVOKED = 'ALL_SESSIONS_REVOKED',

  // Permission & Access Control Events
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',

  // Resource Management Events
  RESOURCE_CREATED = 'RESOURCE_CREATED',
  RESOURCE_UPDATED = 'RESOURCE_UPDATED',
  RESOURCE_DELETED = 'RESOURCE_DELETED',
  RESOURCE_ACCESSED = 'RESOURCE_ACCESSED',

  // Security Events
  CSRF_TOKEN_VALIDATION_FAILED = 'CSRF_TOKEN_VALIDATION_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

export interface AuditLogData {
  userId?: number;
  action: AuditAction | string;
  resource?: string;
  resourceId?: number | string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  status?: 'SUCCESS' | 'FAILURE' | 'ERROR';
  errorMessage?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private prisma: DatabaseService) {}

  /**
   * Create an audit log entry
   */
  async log(data: AuditLogData): Promise<void> {
    try {
      // Sanitize all inputs before logging
      const sanitizedData = {
        userId: data.userId || null,
        action: LogSanitizer.sanitizeMessage(data.action, 100),
        resource: data.resource ? LogSanitizer.sanitizeMessage(data.resource, 100) : null,
        resourceId: data.resourceId ? this.sanitizeResourceId(data.resourceId) : null,
        details: data.details ? LogSanitizer.sanitizeObject(data.details, 3) : null,
        ipAddress: data.ipAddress ? LogSanitizer.sanitizeMessage(data.ipAddress, 45) : null,
        userAgent: data.userAgent ? LogSanitizer.sanitizeMessage(data.userAgent, 200) : null,
        status: data.status || 'SUCCESS',
        errorMessage: data.errorMessage ? LogSanitizer.sanitizeMessage(data.errorMessage, 500) : null,
      };

      await this.prisma.auditLog.create({
        data: sanitizedData,
      });

      // Also log to application logger for immediate visibility
      this.logger.log(
        `[AUDIT] ${sanitizedData.action} by user ${sanitizedData.userId || 'SYSTEM'} - Status: ${sanitizedData.status}`
      );
    } catch (error) {
      // CRITICAL: Never let audit logging failure break the application
      // But log the failure for investigation
      this.logger.error(`Failed to create audit log: ${error.message}`, error.stack);
    }
  }

  /**
   * Log a successful action
   */
  async logSuccess(data: Omit<AuditLogData, 'status'>): Promise<void> {
    await this.log({ ...data, status: 'SUCCESS' });
  }

  /**
   * Log a failed action
   */
  async logFailure(data: Omit<AuditLogData, 'status'>): Promise<void> {
    await this.log({ ...data, status: 'FAILURE' });
  }

  /**
   * Log an error
   */
  async logError(data: Omit<AuditLogData, 'status'>): Promise<void> {
    await this.log({ ...data, status: 'ERROR' });
  }

  /**
   * Log authentication event
   */
  async logAuth(
    action: AuditAction,
    userId: number | null,
    success: boolean,
    details: {
      ipAddress?: string;
      userAgent?: string;
      errorMessage?: string;
      additionalInfo?: any;
    }
  ): Promise<void> {
    await this.log({
      userId: userId || undefined,
      action,
      resource: 'Authentication',
      details: details.additionalInfo,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      status: success ? 'SUCCESS' : 'FAILURE',
      errorMessage: details.errorMessage,
    });
  }

  /**
   * Log user management event
   */
  async logUserManagement(
    action: AuditAction,
    performedBy: number,
    targetUserId: number,
    details: {
      changes?: any;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    await this.log({
      userId: performedBy,
      action,
      resource: 'User',
      resourceId: targetUserId,
      details: details.changes,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      status: 'SUCCESS',
    });
  }

  /**
   * Query audit logs with filters
   */
  async query(filters: {
    userId?: number;
    action?: string;
    resource?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const {
      userId,
      action,
      resource,
      status,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = filters;

    const where: any = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserLogs(userId: number, limit = 50) {
    return this.query({ userId, limit });
  }

  /**
   * Get audit logs for a specific resource
   */
  async getResourceLogs(resource: string, resourceId: number, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: {
        resource,
        resourceId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get security events (failed logins, access denied, etc.)
   */
  async getSecurityEvents(startDate?: Date, limit = 100) {
    const securityActions = [
      AuditAction.LOGIN_FAILURE,
      AuditAction.LOGIN_LOCKED,
      AuditAction.MFA_VERIFY_FAILURE,
      AuditAction.ACCESS_DENIED,
      AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
      AuditAction.CSRF_TOKEN_VALIDATION_FAILED,
      AuditAction.RATE_LIMIT_EXCEEDED,
      AuditAction.SUSPICIOUS_ACTIVITY,
    ];

    const where: any = {
      action: { in: securityActions },
    };

    if (startDate) {
      where.createdAt = { gte: startDate };
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get statistics about audit logs
   */
  async getStatistics(startDate?: Date, endDate?: Date) {
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [
      totalLogs,
      successCount,
      failureCount,
      errorCount,
      uniqueUsers,
      topActions,
    ] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.count({ where: { ...where, status: 'SUCCESS' } }),
      this.prisma.auditLog.count({ where: { ...where, status: 'FAILURE' } }),
      this.prisma.auditLog.count({ where: { ...where, status: 'ERROR' } }),
      this.prisma.auditLog.findMany({
        where,
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.$queryRaw`
        SELECT action, COUNT(*) as count
        FROM "AuditLog"
        WHERE ${startDate ? `"createdAt" >= ${startDate}` : '1=1'}
        ${endDate ? `AND "createdAt" <= ${endDate}` : ''}
        GROUP BY action
        ORDER BY count DESC
        LIMIT 10
      `,
    ]);

    return {
      totalLogs,
      successCount,
      failureCount,
      errorCount,
      uniqueUsers: uniqueUsers.length,
      topActions,
    };
  }

  /**
   * Sanitize resource ID
   */
  private sanitizeResourceId(id: number | string): number | null {
    if (typeof id === 'number') {
      return id;
    }
    const parsed = parseInt(id, 10);
    return isNaN(parsed) ? null : parsed;
  }
}

