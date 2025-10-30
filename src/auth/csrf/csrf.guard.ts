import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfService } from './csrf.service';
import { Request } from 'express';

export const CSRF_SKIP_KEY = 'csrf_skip';
export const SkipCsrf = () => SetMetadata(CSRF_SKIP_KEY, true);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private csrfService: CsrfService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Skip CSRF check if decorated with @SkipCsrf
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(CSRF_SKIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (skipCsrf) {
      return true;
    }

    // Skip CSRF for GET, HEAD, OPTIONS requests (safe methods)
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    // Extract CSRF token from header
    const csrfToken = request.headers['x-csrf-token'] as string;
    if (!csrfToken) {
      throw new ForbiddenException('CSRF token missing');
    }

    // Extract session ID from request (you might need to adjust this based on your session implementation)
    const sessionId = this.extractSessionId(request);
    const userId = this.extractUserId(request);

    // Validate CSRF token
    const isValid = await this.csrfService.validateToken(csrfToken, sessionId, userId);
    if (!isValid) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }

  /**
   * Extract session ID from request
   * Adjust this method based on your session implementation
   */
  private extractSessionId(request: Request): string | undefined {
    // Option 1: From cookies (if you store session ID in cookies)
    const sessionCookie = request.cookies?.sessionId;
    if (sessionCookie) {
      return sessionCookie;
    }

    // Option 2: From headers
    const sessionHeader = request.headers['x-session-id'] as string;
    if (sessionHeader) {
      return sessionHeader;
    }

    // Option 3: From JWT token (if you include session ID in JWT)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload.sessionId || payload.jti; // Use JTI as session identifier
      } catch (error) {
        // Token parsing failed, continue without session ID
      }
    }

    return undefined;
  }

  /**
   * Extract user ID from request
   */
  private extractUserId(request: Request): number | undefined {
    // Option 1: From JWT token
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload.sub;
      } catch (error) {
        // Token parsing failed, continue without user ID
      }
    }

    // Option 2: From request object (if set by previous middleware)
    return (request as any).user?.id;
  }
}

/**
 * Double-submit cookie CSRF guard
 * This implements the double-submit cookie pattern for additional security
 */
@Injectable()
export class DoubleSubmitCsrfGuard implements CanActivate {
  constructor(
    private csrfService: CsrfService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Skip CSRF check if decorated with @SkipCsrf
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(CSRF_SKIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (skipCsrf) {
      return true;
    }

    // Skip CSRF for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    // Extract CSRF token from header
    const csrfToken = request.headers['x-csrf-token'] as string;
    if (!csrfToken) {
      throw new ForbiddenException('CSRF token missing');
    }

    // Extract cookie value
    const cookieValue = request.cookies?.['csrf-token'];
    if (!cookieValue) {
      throw new ForbiddenException('CSRF cookie missing');
    }

    // Extract session/user info
    const sessionId = this.extractSessionId(request);
    const userId = this.extractUserId(request);

    // Validate double-submit pattern
    const isValid = await this.csrfService.validateDoubleSubmit(
      csrfToken,
      cookieValue,
      sessionId,
      userId,
    );

    if (!isValid) {
      throw new ForbiddenException('Invalid CSRF token or cookie');
    }

    return true;
  }

  private extractSessionId(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
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

  private extractUserId(request: Request): number | undefined {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload.sub;
      } catch (error) {
        // Token parsing failed
      }
    }
    return (request as any).user?.id;
  }
}
