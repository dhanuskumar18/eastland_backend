import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../common/cache/cache.service';

interface CachedRoles {
  admin: { id: number } | null;
  user: { id: number } | null;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private readonly CACHE_TTL = 180; // 3 minutes (dashboard data changes frequently)
  
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
  ) {}

  async getDashboardStats() {
    const startTime = Date.now();
    const cacheKey = 'dashboard:stats';
    
    // Try to get from cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      const cacheTime = Date.now() - startTime;
      console.log(`\n=== DASHBOARD CACHE HIT ===`);
      console.log(`Cache Time: ${cacheTime}ms`);
      console.log(`===========================\n`);
      this.logger.debug(`Cache hit for ${cacheKey} in ${cacheTime}ms`);
      return cached;
    }

    // Get role IDs first for user statistics (cache roles for 1 hour)
    const roleCacheKey = 'dashboard:roles';
    let adminRole, userRole;
    
    const cachedRoles = await this.cache.get<CachedRoles>(roleCacheKey);
    if (cachedRoles) {
      adminRole = cachedRoles.admin;
      userRole = cachedRoles.user;
    } else {
      [adminRole, userRole] = await Promise.all([
        this.db.role.findFirst({ 
          where: { name: 'ADMIN' },
          select: { id: true }
        }),
        this.db.role.findFirst({ 
          where: { name: 'USER' },
          select: { id: true }
        }),
      ]);
      // Cache roles for 1 hour (they rarely change)
      await this.cache.set(roleCacheKey, { admin: adminRole, user: userRole }, 3600);
    }

    // Use raw SQL for faster counts - single query instead of 14 separate queries
    // This is significantly faster than multiple count() calls
    const adminRoleId = adminRole?.id ?? null;
    const userRoleId = userRole?.id ?? null;
    
    const statsQuery = this.db.$queryRaw<Array<{
      pages_total: bigint;
      products_total: bigint;
      users_total: bigint;
      users_active: bigint;
      users_inactive: bigint;
      users_admin: bigint;
      users_user: bigint;
      categories_total: bigint;
      tags_total: bigint;
      brands_total: bigint;
      testimonials_total: bigint;
      youtube_videos_total: bigint;
      contact_forms_total: bigint;
      globals_total: bigint;
    }>>`
      SELECT 
        (SELECT COUNT(*) FROM "Page") as pages_total,
        (SELECT COUNT(*) FROM "Product") as products_total,
        (SELECT COUNT(*) FROM "User") as users_total,
        (SELECT COUNT(*) FROM "User" WHERE status = 'ACTIVE') as users_active,
        (SELECT COUNT(*) FROM "User" WHERE status = 'INACTIVE') as users_inactive,
        (SELECT COUNT(*) FROM "User" WHERE "roleId" = ${adminRoleId ?? 0}) as users_admin,
        (SELECT COUNT(*) FROM "User" WHERE "roleId" = ${userRoleId ?? 0}) as users_user,
        (SELECT COUNT(*) FROM "Category") as categories_total,
        (SELECT COUNT(*) FROM "Tag") as tags_total,
        (SELECT COUNT(*) FROM "Brand") as brands_total,
        (SELECT COUNT(*) FROM "Testimonial") as testimonials_total,
        (SELECT COUNT(*) FROM "YouTubeVideo") as youtube_videos_total,
        (SELECT COUNT(*) FROM "ContactSubmission") as contact_forms_total,
        (SELECT COUNT(*) FROM "globals") as globals_total
    `;

    const queryStart = Date.now();
    const stats = await statsQuery;
    const queryTime = Date.now() - queryStart;
    console.log(`\n=== DASHBOARD QUERY TIMING ===`);
    console.log(`SQL Query: ${queryTime}ms`);
    this.logger.log(`Dashboard SQL query took ${queryTime}ms`);
    const row = stats[0];
    
    // Convert BigInt to Number for JSON serialization
    const pagesTotal = Number(row.pages_total);
    const productsTotal = Number(row.products_total);
    const usersTotal = Number(row.users_total);
    const usersActive = Number(row.users_active);
    const usersInactive = Number(row.users_inactive);
    const usersAdmin = Number(row.users_admin);
    const usersUser = Number(row.users_user);
    const categoriesTotal = Number(row.categories_total);
    const tagsTotal = Number(row.tags_total);
    const brandsTotal = Number(row.brands_total);
    const testimonialsTotal = Number(row.testimonials_total);
    const youtubeVideosTotal = Number(row.youtube_videos_total);
    const contactFormsStats = Number(row.contact_forms_total);
    const globalsTotal = Number(row.globals_total);

    // Build stats object
    const result = {
      stats: {
        pages: {
          total: pagesTotal,
        },
        products: {
          total: productsTotal,
        },
        users: {
          total: usersTotal,
          active: usersActive,
          inactive: usersInactive,
          admin: usersAdmin,
          user: usersUser,
        },
        categories: {
          total: categoriesTotal,
        },
        tags: {
          total: tagsTotal,
        },
        brands: {
          total: brandsTotal,
        },
        testimonials: {
          total: testimonialsTotal,
        },
        youtubeVideos: {
          total: youtubeVideosTotal,
        },
        contactForms: {
          total: contactFormsStats,
          // Note: ContactSubmission model doesn't have read/unread field
          // Setting unread to total and read to 0 as placeholder
          // This can be updated when read/unread tracking is implemented
          unread: contactFormsStats,
          read: 0,
        },
        portfolio: {
          // Note: Portfolio model doesn't exist in schema
          // Returning 0 as placeholder
          total: 0,
        },
        globals: {
          total: globalsTotal,
        },
      },
      recentActivity: [], // Optional - can be implemented later
    };

    // Cache the result
    await this.cache.set(cacheKey, result, this.CACHE_TTL);

    const totalTime = Date.now() - startTime;
    console.log(`Total Time: ${totalTime}ms`);
    console.log(`============================\n`);
    this.logger.log(`Dashboard stats generated in ${totalTime}ms (query: ${queryTime}ms)`);
    return result;
  }
}

