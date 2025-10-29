import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionService } from './session.service';
import { CsrfService } from '../auth/csrf/csrf.service';

@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(
    private sessionService: SessionService,
    private csrfService: CsrfService,
  ) {}

  /**
   * Clean up expired sessions every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredSessions() {
    this.logger.log('Starting session cleanup...');
    try {
      const cleanedCount = await this.sessionService.cleanupExpiredSessions();
      this.logger.log(`Session cleanup completed. Cleaned ${cleanedCount} sessions.`);
    } catch (error) {
      this.logger.error('Session cleanup failed:', error);
    }
  }

  /**
   * Clean up expired CSRF tokens every 30 minutes
   */
  @Cron('0 */30 * * * *')
  async cleanupExpiredCsrfTokens() {
    this.logger.log('Starting CSRF token cleanup...');
    try {
      const cleanedCount = await this.csrfService.cleanupExpiredTokens();
      this.logger.log(`CSRF token cleanup completed. Cleaned ${cleanedCount} tokens.`);
    } catch (error) {
      this.logger.error('CSRF token cleanup failed:', error);
    }
  }

  /**
   * Clean up expired sessions every day at 2 AM
   */
  @Cron('0 2 * * *')
  async dailySessionCleanup() {
    this.logger.log('Starting daily session cleanup...');
    try {
      const cleanedCount = await this.sessionService.cleanupExpiredSessions();
      this.logger.log(`Daily session cleanup completed. Cleaned ${cleanedCount} sessions.`);
    } catch (error) {
      this.logger.error('Daily session cleanup failed:', error);
    }
  }
}
