import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import * as crypto from 'crypto';

export interface CsrfTokenData {
  token: string;
  expiresAt: Date;
  sessionId?: string;
  userId?: number;
}

@Injectable()
export class CsrfService {
  private readonly logger = new Logger(CsrfService.name);
  private readonly tokenExpiryMinutes = 30; // CSRF tokens expire in 30 minutes

  constructor(
    private config: ConfigService,
    private prisma: DatabaseService,
  ) {}

  /**
   * Generate a new CSRF token
   */
  async generateToken(sessionId?: string, userId?: number): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.tokenExpiryMinutes * 60 * 1000);

    // Store token in database for validation
    await this.prisma.csrfToken.create({
      data: {
        token,
        expiresAt,
        sessionId,
        userId,
      },
    });

    this.logger.debug(`Generated CSRF token for session: ${sessionId}`);
    return token;
  }

  /**
   * Validate a CSRF token
   */
  async validateToken(token: string, sessionId?: string, userId?: number): Promise<boolean> {
    try {
      const csrfToken = await this.prisma.csrfToken.findFirst({
        where: {
          token,
          expiresAt: { gt: new Date() }, // Not expired
          ...(sessionId && { sessionId }),
          ...(userId && { userId }),
        },
      });

      if (!csrfToken) {
        this.logger.warn(`Invalid CSRF token: ${token}`);
        return false;
      }

      // Optional: Delete token after use for additional security (one-time use)
      // await this.prisma.csrfToken.delete({ where: { id: csrfToken.id } });

      return true;
    } catch (error) {
      this.logger.error(`Error validating CSRF token: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate CSRF token for a specific session
   */
  async generateSessionToken(sessionId: string): Promise<string> {
    return this.generateToken(sessionId);
  }

  /**
   * Generate CSRF token for a specific user
   */
  async generateUserToken(userId: number): Promise<string> {
    return this.generateToken(undefined, userId);
  }

  /**
   * Clean up expired CSRF tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.csrfToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired CSRF tokens`);
    return result.count;
  }

  /**
   * Revoke all CSRF tokens for a specific session
   */
  async revokeSessionTokens(sessionId: string): Promise<number> {
    const result = await this.prisma.csrfToken.deleteMany({
      where: { sessionId },
    });

    this.logger.log(`Revoked ${result.count} CSRF tokens for session: ${sessionId}`);
    return result.count;
  }

  /**
   * Revoke all CSRF tokens for a specific user
   */
  async revokeUserTokens(userId: number): Promise<number> {
    const result = await this.prisma.csrfToken.deleteMany({
      where: { userId },
    });

    this.logger.log(`Revoked ${result.count} CSRF tokens for user: ${userId}`);
    return result.count;
  }

  /**
   * Get CSRF token info (for debugging/admin purposes)
   */
  async getTokenInfo(token: string): Promise<CsrfTokenData | null> {
    const csrfToken = await this.prisma.csrfToken.findUnique({
      where: { token },
    });

    if (!csrfToken) {
      return null;
    }

    return {
      token: csrfToken.token,
      expiresAt: csrfToken.expiresAt,
      sessionId: csrfToken.sessionId || undefined,
      userId: csrfToken.userId || undefined,
    };
  }

  /**
   * Generate a secure random string for additional entropy
   */
  private generateSecureRandom(): string {
    return crypto.randomBytes(16).toString('base64url');
  }

  /**
   * Create a double-submit cookie value
   */
  async createDoubleSubmitCookie(sessionId?: string, userId?: number): Promise<{
    token: string;
    cookieValue: string;
  }> {
    const token = await this.generateToken(sessionId, userId);
    const secret = this.config.get('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    const cookieValue = crypto.createHmac('sha256', secret)
      .update(token)
      .digest('hex');

    return { token, cookieValue };
  }

  /**
   * Validate double-submit cookie pattern
   */
  async validateDoubleSubmit(
    token: string,
    cookieValue: string,
    sessionId?: string,
    userId?: number,
  ): Promise<boolean> {
    // First validate the token exists and is not expired
    const tokenValid = await this.validateToken(token, sessionId, userId);
    if (!tokenValid) {
      return false;
    }

    // Then validate the cookie value matches the token
    const secret = this.config.get('JWT_SECRET');
    if (!secret) {
      return false;
    }
    const expectedCookieValue = crypto.createHmac('sha256', secret)
      .update(token)
      .digest('hex');

    return cookieValue === expectedCookieValue;
  }
}
