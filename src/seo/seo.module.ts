import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [SeoController],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoModule {}

