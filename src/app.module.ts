import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HttpCacheInterceptor } from './common/interceptors/http-cache.interceptor';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { SessionModule } from './session/session.module';
import { EmailModule } from './email/email.module';
import { UserModule } from './user/user.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PublicThrottlerGuard } from './common/guards/public-throttler.guard';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { DoubleSubmitCsrfGuard } from './auth/csrf/csrf.guard';
import { UserStatusGuard } from './auth/guard/user-status.guard';
import { PagesModule } from './pages/pages.module';
import { SectionsModule } from './sections/sections.module';
import { CategoryModule } from './category/category.module';
import { TagsModule } from './tags/tags.module';
import { BrandModule } from './brand/brand.module';
import { GlobalsModule } from './globals/globals.module';
import { ProductsModule } from './products/products.module';
import { UploadModule } from './upload/upload.module';
import { SeoModule } from './seo/seo.module';
import { TestimonialsModule } from './testimonials/testimonials.module';
import { YouTubeVideosModule } from './youtube-videos/youtube-videos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ContactSubmissionsModule } from './contact-submissions/contact-submissions.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { RolesModule } from './roles/roles.module';
import { CommonModule } from './common/common.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  controllers: [AppController],
  imports: [
    CommonModule, // Global module for audit logging and utilities
    AuthModule,
    SessionModule,
    EmailModule,
    UserModule,
    DatabaseModule, 
    PagesModule,
    SectionsModule,
    CategoryModule,
    TagsModule,
    BrandModule,
    GlobalsModule,
    ProductsModule,
    UploadModule,
    SeoModule,
    TestimonialsModule,
    YouTubeVideosModule,
    DashboardModule,
    ContactSubmissionsModule,
    AuditLogsModule,
    RolesModule,
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
      {
        name: 'password-reset',
        ttl: 300000, // 5 minutes
        limit: 10, // 10 attempts per 5 minutes for password reset flow
      },
      {
        name: 'login',
        ttl: 60000, // 1 minute
        limit: 6, // 6 attempts per minute (allows 5 failed + 1 to show lockout message)
      },
    ]),
  ],
  providers: [
    // ERROR HANDLING & LOGGING CHECKLIST ITEM #9: Global exception filter
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: PublicThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: DoubleSubmitCsrfGuard,
    },
    {
      provide: APP_GUARD,
      useClass: UserStatusGuard,
    },
    // PERFORMANCE: HTTP caching interceptor for GET requests
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor,
    },
  ],
})
export class AppModule {}
