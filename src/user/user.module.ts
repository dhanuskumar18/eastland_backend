import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { DatabaseModule } from '../database/database.module';
import { CacheService } from '../common/cache/cache.service';
import { RolesModule } from '../roles/roles.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [DatabaseModule, RolesModule, EmailModule],
  controllers: [UserController],
  providers: [UserService, CacheService],
  exports: [UserService],
})
export class UserModule {}
