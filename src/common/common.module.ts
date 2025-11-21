import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './services/audit-log.service';
import { DatabaseModule } from '../database/database.module';

/**
 * Common Module
 * 
 * Global module that provides common services across the application
 * - Audit logging service
 * - Log sanitization utilities
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class CommonModule {}

