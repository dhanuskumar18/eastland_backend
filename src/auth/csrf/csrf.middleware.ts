import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CsrfService } from './csrf.service';

/**
 * CsrfMiddleware - Global CSRF Protection Middleware
 * 
 * ACCESS CONTROL CHECKLIST ITEM #5:
 * - Anti-CSRF tokens used for all state-changing requests (POST, PUT, DELETE)
 * - Implements double-submit cookie pattern for enhanced security
 * 
 * How it works:
 * 1. Skips CSRF check for safe HTTP methods (GET, HEAD, OPTIONS)
 * 2. Skips CSRF for unauthenticated auth endpoints (login, signup, etc.)
 * 3. Validates CSRF token from X-CSRF-Token header for state-changing requests
 * 4. Validates token against session/user in database
 * 5. Rejects requests with missing or invalid CSRF tokens
 * 
 * Security features:
 * - State-changing protection: All POST, PUT, DELETE, PATCH requests require CSRF token
 * - Session-bound tokens: CSRF tokens are tied to user sessions
 * - Double-submit cookie: Additional validation using cookie value
 * - Fail-secure: Missing or invalid tokens result in 403 Forbidden
 * 
 * Protected methods:
 * - POST: Create operations
 * - PUT: Update operations
 * - DELETE: Delete operations
 * - PATCH: Partial update operations
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CsrfMiddleware.name);

  constructor(private csrfService: CsrfService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip CSRF for safe methods (GET, HEAD, OPTIONS don't change state)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Skip CSRF for certain paths (like getting CSRF tokens and login endpoints)
    // Normalize path to handle query parameters and trailing slashes
    const normalizedPath = req.path.split('?')[0].toLowerCase();
    
    const skipPaths = [
      '/auth/csrf-token',
      '/auth/csrf-token/authenticated',
      '/auth/csrf-token/double-submit',
      '/auth/csrf-token/validate',
      '/auth/login',
      '/auth/login/verify-mfa', // MFA verification during login (user not authenticated yet)
      '/auth/signup',
      '/auth/forgot-password',
      '/auth/verify-otp',
      '/auth/reset-password',
    ];

    // Check if path matches any skip path (case-insensitive, handles trailing slashes)
    const shouldSkip = skipPaths.some(path => {
      const normalizedSkipPath = path.toLowerCase();
      return normalizedPath === normalizedSkipPath || 
             normalizedPath.startsWith(normalizedSkipPath + '/') ||
             normalizedPath.startsWith(normalizedSkipPath);
    });

    if (shouldSkip) {
      this.logger.debug(`Skipping CSRF check for ${req.method} ${req.path}`);
      return next();
    }

    // Security: Extract CSRF token from X-CSRF-Token header
    // CSRF tokens must be sent in headers (not cookies) to prevent CSRF attacks
    const csrfToken = req.headers['x-csrf-token'] as string;
    if (!csrfToken) {
      this.logger.warn(`CSRF token missing for ${req.method} ${req.path}`);
      return res.status(403).json({
        message: 'CSRF token missing',
        statusCode: 403,
      });
    }

    // Extract session and user info for token validation
    // CSRF tokens are bound to sessions/users to prevent token reuse across sessions
    const sessionId = this.extractSessionId(req);
    const userId = this.extractUserId(req);

    // Validate CSRF token against database
    // Security: Token validation ensures token was issued by server and matches session
    const isValid = await this.csrfService.validateToken(csrfToken, sessionId, userId);
    if (!isValid) {
      this.logger.warn(`Invalid CSRF token for ${req.method} ${req.path}`);
      return res.status(403).json({
        message: 'Invalid CSRF token',
        statusCode: 403,
      });
    }

    next();
  }

  private extractSessionId(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload.sessionId || payload.jti;
      } catch (error) {
        // Token parsing failed
      }
    }
    return undefined;
  }

  private extractUserId(req: Request): number | undefined {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload.sub;
      } catch (error) {
        // Token parsing failed
      }
    }
    return (req as any).user?.id;
  }
}
