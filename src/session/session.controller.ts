import { 
  Controller, 
  Get, 
  Delete, 
  Param, 
  UseGuards, 
  Req, 
  Res, 
  Query,
  Post,
  Body,
  BadRequestException,
  NotFoundException
} from '@nestjs/common';
import { JwtGuard } from '../auth/guard';
import { GetUser } from '../auth/decorator';
import { SessionService } from './session.service';
import type { Request } from 'express';
import type { Response } from 'express';

@Controller('auth/sessions')
@UseGuards(JwtGuard)
export class SessionController {
  constructor(private sessionService: SessionService) {}

  /**
   * Get all active sessions for the current user
   */
  @Get()
  async getUserSessions(@GetUser('id') userId: number) {
    return this.sessionService.getUserSessions(userId);
  }

  /**
   * Get session statistics for the current user
   */
  @Get('stats')
  async getSessionStats(@GetUser('id') userId: number) {
    return this.sessionService.getSessionStats(userId);
  }

  /**
   * Get activity history for a specific session
   */
  @Get(':sessionId/activity')
  async getSessionActivity(
    @Param('sessionId') sessionId: string,
    @GetUser('id') userId: number,
    @Query('limit') limit?: string,
  ) {
    // Verify the session belongs to the user
    const sessions = await this.sessionService.getUserSessions(userId);
    const sessionExists = sessions.some(session => session.id === sessionId);
    
    if (!sessionExists) {
      throw new NotFoundException('Session not found');
    }

    const limitNumber = limit ? parseInt(limit, 10) : 50;
    return this.sessionService.getSessionActivity(sessionId, limitNumber);
  }

  /**
   * Revoke a specific session
   */
  @Delete(':sessionId')
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @GetUser('id') userId: number,
  ) {
    const success = await this.sessionService.revokeSession(sessionId, userId);
    if (!success) {
      throw new NotFoundException('Session not found or already revoked');
    }
    return { message: 'Session revoked successfully' };
  }

  /**
   * Revoke all other sessions (keep current)
   */
  @Delete('others')
  async revokeAllOtherSessions(
    @GetUser('id') userId: number,
    @GetUser('sessionId') currentSessionId: string,
  ) {
    if (!currentSessionId) {
      throw new BadRequestException('Current session not found');
    }
    
    const count = await this.sessionService.revokeAllOtherSessions(userId, currentSessionId);
    return { 
      message: `${count} sessions revoked successfully`,
      revokedCount: count 
    };
  }

  /**
   * Revoke all sessions and logout
   */
  @Delete('all')
  async revokeAllSessions(
    @GetUser('id') userId: number,
    @Res() res: Response,
  ) {
    await this.sessionService.revokeAllUserSessions(userId);
    // Note: This endpoint should be handled by AuthController for proper logout
    return { message: 'All sessions revoked successfully' };
  }

  /**
   * Extend session expiration
   */
  @Post(':sessionId/extend')
  async extendSession(
    @Param('sessionId') sessionId: string,
    @GetUser('id') userId: number,
    @Body() body: { days?: number },
  ) {
    const days = body.days || 7;
    const success = await this.sessionService.extendSession(sessionId, userId, days);
    
    if (!success) {
      throw new NotFoundException('Session not found or already expired');
    }
    
    return { 
      message: `Session extended by ${days} days`,
      extendedDays: days 
    };
  }

  /**
   * Get current session information
   */
  @Get('current')
  async getCurrentSession(
    @GetUser('id') userId: number,
    @GetUser('sessionId') sessionId: string,
  ) {
    if (!sessionId) {
      throw new BadRequestException('No active session found');
    }

    const sessions = await this.sessionService.getUserSessions(userId);
    const currentSession = sessions.find(session => session.id === sessionId);
    
    if (!currentSession) {
      throw new NotFoundException('Current session not found');
    }

    return currentSession;
  }
}
