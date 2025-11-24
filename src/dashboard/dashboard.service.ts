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
    const cacheKey = 'dashboard:stats';
    
    // Try to get from cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
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

    // Execute all queries in parallel for better performance
    const [
      pagesTotal,
      productsTotal,
      usersTotal,
      usersActive,
      usersInactive,
      usersAdmin,
      usersUser,
      categoriesTotal,
      tagsTotal,
      brandsTotal,
      testimonialsTotal,
      youtubeVideosTotal,
      contactFormsStats,
      globalsTotal,
    ] = await Promise.all([
      // Pages - no status field in schema, return total only
      this.db.page.count(),
      
      // Products - no status field in schema, return total only
      this.db.product.count(),
      
      // Users - total count
      this.db.user.count(),
      
      // Users - active count
      this.db.user.count({ where: { status: 'ACTIVE' } }),
      
      // Users - inactive count
      this.db.user.count({ where: { status: 'INACTIVE' } }),
      
      // Users - admin count
      adminRole ? this.db.user.count({ where: { roleId: adminRole.id } }) : Promise.resolve(0),
      
      // Users - user count
      userRole ? this.db.user.count({ where: { roleId: userRole.id } }) : Promise.resolve(0),
      
      // Categories
      this.db.category.count(),
      
      // Tags
      this.db.tag.count(),
      
      // Brands
      this.db.brand.count(),
      
      // Testimonials - no status field in schema, return total only
      this.db.testimonial.count(),
      
      // YouTube Videos
      this.db.youTubeVideo.count(),
      
      // Contact Forms - no read/unread field in schema, return total only
      this.db.contactSubmission.count(),
      
      // Globals
      this.db.globals.count(),
    ]);

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

    return result;
  }
}

