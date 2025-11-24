import { Module } from '@nestjs/common';
import { ContactSubmissionsService } from './contact-submissions.service';
import { ContactSubmissionsController } from './contact-submissions.controller';
import { DatabaseModule } from '../database/database.module';
import { CacheService } from '../common/cache/cache.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ContactSubmissionsController],
  providers: [ContactSubmissionsService, CacheService],
  exports: [ContactSubmissionsService],
})
export class ContactSubmissionsModule {}

