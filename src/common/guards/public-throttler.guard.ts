import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Custom ThrottlerGuard that skips throttling for:
 * 1. GET requests to public endpoints (products, videos, testimonials, pages, etc.)
 * 2. Endpoints decorated with @SkipThrottle() (handled by parent class)
 * 3. All GET requests to public read-only endpoints
 */
@Injectable()
export class PublicThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Skip throttling for GET requests to public endpoints
    if (request.method === 'GET') {
      const path = request.path?.toLowerCase() || '';
      
      // List of public endpoints that should not be throttled
      const publicEndpoints = [
        '/products',
        '/youtube-videos',
        '/testimonials',
        '/pages',
        '/categories',
        '/tags',
        '/brands',
        '/globals',
        '/sections',
      ];

      const isPublicEndpoint = publicEndpoints.some(endpoint =>
        path.startsWith(endpoint),
      );

      if (isPublicEndpoint) {
        return true;
      }
    }

    // For all other requests, apply normal throttling (includes @SkipThrottle() check)
    return super.canActivate(context);
  }
}

