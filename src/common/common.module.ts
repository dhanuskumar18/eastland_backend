import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuditLogService } from './services/audit-log.service';
import { CaptchaService } from './services/captcha.service';
import { DatabaseModule } from '../database/database.module';

/**
 * Common Module
 * 
 * Global module that provides common services across the application
 * - Audit logging service
 * - CAPTCHA service for bot detection
 * - Log sanitization utilities
 */
@Global()
@Module({
  imports: [DatabaseModule, HttpModule],
  providers: [AuditLogService, CaptchaService],
  exports: [AuditLogService, CaptchaService],
})
export class CommonModule {}

