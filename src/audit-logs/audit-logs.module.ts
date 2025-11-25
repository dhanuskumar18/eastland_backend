import { Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [AuditLogsController],
})
export class AuditLogsModule {}

