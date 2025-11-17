import { Module } from '@nestjs/common';
import { ContactSubmissionsService } from './contact-submissions.service';
import { ContactSubmissionsController } from './contact-submissions.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ContactSubmissionsController],
  providers: [ContactSubmissionsService],
  exports: [ContactSubmissionsService],
})
export class ContactSubmissionsModule {}

