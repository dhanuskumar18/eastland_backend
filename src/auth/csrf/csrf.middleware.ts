import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CsrfService } from './csrf.service';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CsrfMiddleware.name);

  constructor(private csrfService: CsrfService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip CSRF for safe methods
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

    // Extract CSRF token from header
    const csrfToken = req.headers['x-csrf-token'] as string;
    if (!csrfToken) {
      this.logger.warn(`CSRF token missing for ${req.method} ${req.path}`);
      return res.status(403).json({
        message: 'CSRF token missing',
        statusCode: 403,
      });
    }

    // Extract session and user info
    const sessionId = this.extractSessionId(req);
    const userId = this.extractUserId(req);

    // Validate CSRF token
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
