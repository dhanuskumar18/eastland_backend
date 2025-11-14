import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  async getDashboardStats() {
    // Get role IDs first for user statistics
    const [adminRole, userRole] = await Promise.all([
      this.db.role.findFirst({ where: { name: 'ADMIN' } }),
      this.db.role.findFirst({ where: { name: 'USER' } }),
    ]);

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
    const stats = {
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
    };

    return {
      stats,
      recentActivity: [], // Optional - can be implemented later
    };
  }
}

