import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { SessionModule } from './session/session.module';
import { EmailModule } from './email/email.module';
import { UserModule } from './user/user.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { CsrfMiddleware } from './auth/csrf/csrf.middleware';

@Module({
  imports: [
    AuthModule,
    SessionModule,
    EmailModule,
    UserModule,
    DatabaseModule, 
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply CSRF middleware to all routes except auth endpoints that need to skip CSRF
    consumer
      .apply(CsrfMiddleware)
      .exclude(
        { path: 'auth/csrf-token', method: RequestMethod.ALL },
        { path: 'auth/csrf-token/authenticated', method: RequestMethod.ALL },
        { path: 'auth/csrf-token/double-submit', method: RequestMethod.ALL },
        { path: 'auth/csrf-token/validate', method: RequestMethod.ALL },
        { path: 'auth/csrf-token/revoke-session', method: RequestMethod.ALL },
        { path: 'auth/csrf-token/revoke-all', method: RequestMethod.ALL },
        { path: 'auth/login', method: RequestMethod.ALL },
        { path: 'auth/logout', method: RequestMethod.ALL },
        { path: 'auth/signup', method: RequestMethod.ALL },
        { path: 'auth/refresh', method: RequestMethod.ALL },
        { path: 'auth/forgot-password', method: RequestMethod.ALL },
        { path: 'auth/verify-otp', method: RequestMethod.ALL },
        { path: 'auth/reset-password', method: RequestMethod.ALL },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
