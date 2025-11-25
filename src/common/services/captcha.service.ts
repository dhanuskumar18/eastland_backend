import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * CAPTCHA Service for bot detection and automated abuse prevention
 * Implements Google reCAPTCHA v2 (Checkbox) validation
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);
  private readonly secretKey: string;
  private readonly verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';

  constructor(
    private config: ConfigService,
    private httpService: HttpService,
  ) {
    this.secretKey = this.config.get<string>('RECAPTCHA_SECRET_KEY') || '';
    
    if (!this.secretKey) {
      this.logger.warn(
        'RECAPTCHA_SECRET_KEY not configured. CAPTCHA validation will be disabled in development mode.'
      );
    }
  }

  /**
   * Verify reCAPTCHA token
   * @param token - reCAPTCHA token from frontend
   * @param remoteIp - User's IP address (optional, recommended)
   * @returns Promise<boolean> - true if valid, false otherwise
   */
  async verifyToken(token: string, remoteIp?: string): Promise<boolean> {
    // Skip validation if secret key is not configured (development mode)
    if (!this.secretKey) {
      this.logger.debug('CAPTCHA validation skipped - secret key not configured');
      return true; // Allow in development
    }

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      this.logger.warn('CAPTCHA token is missing or invalid');
      throw new BadRequestException('CAPTCHA token is required');
    }

    try {
      const params = new URLSearchParams({
        secret: this.secretKey,
        response: token,
      });

      if (remoteIp) {
        params.append('remoteip', remoteIp);
      }

      const response = await firstValueFrom(
        this.httpService.post<{
          success: boolean;
          challenge_ts?: string;
          hostname?: string;
          'error-codes'?: string[];
        }>(this.verifyUrl, params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 5000, // 5 second timeout
        })
      );

      const data = response.data as {
        success: boolean;
        challenge_ts?: string;
        hostname?: string;
        'error-codes'?: string[];
      };

      if (!data.success) {
        this.logger.warn(`CAPTCHA verification failed: ${JSON.stringify(data['error-codes'] || [])}`);
        return false;
      }

      // reCAPTCHA v2 (checkbox) - success is sufficient
      this.logger.debug(`CAPTCHA v2 verified successfully`);
      return true;
    } catch (error) {
      this.logger.error(`CAPTCHA verification error: ${error.message}`, error.stack);
      
      // In case of network errors, we can either:
      // 1. Fail open (allow request) - less secure but better UX
      // 2. Fail closed (block request) - more secure but can block legitimate users
      // We'll fail closed for security, but log the error
      throw new BadRequestException('CAPTCHA verification failed. Please try again.');
    }
  }

  /**
   * Verify CAPTCHA token with detailed response
   * @param token - reCAPTCHA token from frontend
   * @param remoteIp - User's IP address (optional)
   * @returns Promise with detailed verification result
   */
  async verifyTokenDetailed(token: string, remoteIp?: string): Promise<{
    success: boolean;
    challengeTs?: string;
    hostname?: string;
    errors?: string[];
  }> {
    if (!this.secretKey) {
      return {
        success: true,
      };
    }

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new BadRequestException('CAPTCHA token is required');
    }

    try {
      const params = new URLSearchParams({
        secret: this.secretKey,
        response: token,
      });

      if (remoteIp) {
        params.append('remoteip', remoteIp);
      }

      const response = await firstValueFrom(
        this.httpService.post<{
          success: boolean;
          challenge_ts?: string;
          hostname?: string;
          'error-codes'?: string[];
        }>(this.verifyUrl, params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 5000,
        })
      );

      const data = response.data as {
        success: boolean;
        challenge_ts?: string;
        hostname?: string;
        'error-codes'?: string[];
      };
      
      return {
        success: data.success,
        challengeTs: data.challenge_ts,
        hostname: data.hostname,
        errors: data['error-codes'],
      };
    } catch (error) {
      this.logger.error(`CAPTCHA verification error: ${error.message}`, error.stack);
      throw new BadRequestException('CAPTCHA verification failed. Please try again.');
    }
  }
}

