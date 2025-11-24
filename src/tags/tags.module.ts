import { Module } from '@nestjs/common';
import { TagsService } from './tags.service';
import { TagsController } from './tags.controller';
import { DatabaseModule } from '../database/database.module';
import { CacheService } from '../common/cache/cache.service';

@Module({
  imports: [DatabaseModule],
  controllers: [TagsController],
  providers: [TagsService, CacheService],
  exports: [TagsService],
})
export class TagsModule {}

