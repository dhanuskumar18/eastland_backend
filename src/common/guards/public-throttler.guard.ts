import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Custom ThrottlerGuard that skips throttling for:
 * 1. Endpoints decorated with @SkipThrottle() (handled by parent class)
 * 2. GET requests to public endpoints (products, videos, testimonials, pages, etc.)
 * 3. All GET requests to public read-only endpoints
 */
@Injectable()
export class PublicThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Skip throttling for GET requests to public endpoints
    // Check path without query parameters
    if (request.method === 'GET') {
      const path = (request.path || request.url || '').toLowerCase().split('?')[0];
      
      // List of public endpoints that should not be throttled
      const publicEndpoints = [
        '/products',
        '/api/seo',
        '/youtube-videos',
        '/testimonials',
        // '/pages', // COMMENTED OUT FOR NOW - pages edit section should be throttled
        '/categories',
        '/tags',
        '/brands',
        '/globals',
        '/roles/permissions/all', // Skip throttling for permissions list (admin endpoint)
        '/roles', // Skip throttling for roles list (admin endpoint)
        '/users', // Skip throttling for users list (admin endpoint)
        // '/sections', // COMMENTED OUT FOR NOW - sections edit operations should be throttled
      ];

      const isPublicEndpoint = publicEndpoints.some(endpoint =>
        path === endpoint || path.startsWith(endpoint + '/'),
      );

      if (isPublicEndpoint) {
        return true;
      }
    }

    // For all other requests, apply normal throttling (includes @SkipThrottle() check)
    // The parent class will check for @SkipThrottle() decorator automatically
    return super.canActivate(context);
  }
}

