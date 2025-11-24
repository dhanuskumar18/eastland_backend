import { Module } from '@nestjs/common';
import { BrandService } from './brand.service';
import { BrandController } from './brand.controller';
import { DatabaseModule } from '../database/database.module';
import { CacheService } from '../common/cache/cache.service';

@Module({
  imports: [DatabaseModule],
  controllers: [BrandController],
  providers: [BrandService, CacheService],
  exports: [BrandService],
})
export class BrandModule {}


