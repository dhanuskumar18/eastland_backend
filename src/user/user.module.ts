import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { DatabaseModule } from '../database/database.module';
import { CacheService } from '../common/cache/cache.service';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [DatabaseModule, RolesModule],
  controllers: [UserController],
  providers: [UserService, CacheService],
  exports: [UserService],
})
export class UserModule {}
