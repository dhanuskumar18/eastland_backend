import { Module } from '@nestjs/common';
import { GlobalsService } from './globals.service';
import { GlobalsController } from './globals.controller';

@Module({
  controllers: [GlobalsController],
  providers: [GlobalsService],
  exports: [GlobalsService],
})
export class GlobalsModule {}


