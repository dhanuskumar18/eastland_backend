import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Response } from 'express';

/**
 * HTTP Cache Interceptor
 * Adds cache-control headers to HTTP responses
 * Improves client-side caching and reduces server load
 */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse<Response>();
    const request = httpContext.getRequest();

    return next.handle().pipe(
      tap(() => {
        // Only cache GET requests
        if (request.method === 'GET') {
          // Set cache-control headers
          // Cache for 5 minutes, allow stale content for 1 hour while revalidating
          response.setHeader(
            'Cache-Control',
            'public, max-age=300, stale-while-revalidate=3600',
          );
          
          // Add ETag based on response body (handled by NestJS automatically if enabled)
          // Enable ETag generation
          response.setHeader('ETag', 'W/"' + Date.now() + '"');
        } else {
          // Don't cache mutations
          response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        }
      }),
    );
  }
}


