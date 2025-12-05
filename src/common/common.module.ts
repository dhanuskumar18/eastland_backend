import { Global, Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuditLogService } from './services/audit-log.service';
import { CaptchaService } from './services/captcha.service';
import { AbilityFactory } from './services/ability.factory';
import { DatabaseModule } from '../database/database.module';
import { RolesModule } from '../roles/roles.module';

/**
 * Common Module
 * 
 * Global module that provides common services across the application
 * - Audit logging service
 * - CAPTCHA service for bot detection
 * - CASL ability factory for RBAC
 * - Log sanitization utilities
 */
@Global()
@Module({
  imports: [DatabaseModule, HttpModule, forwardRef(() => RolesModule)],
  providers: [AuditLogService, CaptchaService, AbilityFactory],
  exports: [AuditLogService, CaptchaService, AbilityFactory],
})
export class CommonModule {}

