import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
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
        // Check if response headers have already been sent (e.g., by exception filter)
        if (response.headersSent) {
          return;
        }

        // Only cache GET requests
        if (request.method === 'GET') {
          try {
            // Don't cache pages and sections endpoints - they change frequently
            const path = request.url?.split('?')[0] || '';
            const isPagesEndpoint = path.startsWith('/pages') || path.startsWith('/sections');
            
            if (isPagesEndpoint) {
              // No caching for pages/sections - data changes frequently
              response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
              response.setHeader('Pragma', 'no-cache');
              response.setHeader('Expires', '0');
            } else {
              // Set cache-control headers for other GET requests
              // Cache for 5 minutes, allow stale content for 1 hour while revalidating
              response.setHeader(
                'Cache-Control',
                'public, max-age=300, stale-while-revalidate=3600',
              );
              
              // Add ETag based on response body (handled by NestJS automatically if enabled)
              // Enable ETag generation
              response.setHeader('ETag', 'W/"' + Date.now() + '"');
            }
          } catch (error) {
            // Silently ignore if headers can't be set (response already sent)
            // This prevents "Cannot set headers after they are sent" errors
          }
        } else {
          try {
            // Don't cache mutations
            response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          } catch (error) {
            // Silently ignore if headers can't be set (response already sent)
          }
        }
      }),
      catchError((error) => {
        // Re-throw the error to let exception filters handle it
        // Don't try to set headers on error responses
        return throwError(() => error);
      }),
    );
  }
}


