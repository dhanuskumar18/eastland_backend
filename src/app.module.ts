import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { SessionModule } from './session/session.module';
import { EmailModule } from './email/email.module';
import { UserModule } from './user/user.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { DoubleSubmitCsrfGuard } from './auth/csrf/csrf.guard';
import { PagesModule } from './pages/pages.module';
import { SectionsModule } from './sections/sections.module';

@Module({
  imports: [
    AuthModule,
    SessionModule,
    EmailModule,
    UserModule,
    DatabaseModule, 
    PagesModule,
    SectionsModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 3, // 3 requests per second
      },
      {
        name: 'medium',
        ttl: 10000, // 10 seconds
        limit: 20, // 20 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: DoubleSubmitCsrfGuard,
    },
  ],
})
export class AppModule {}
