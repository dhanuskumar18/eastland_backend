import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { DeviceInfo, DeviceDetectionService } from './device-detection.service';
import * as crypto from 'crypto';

export interface SessionData {
  id: string;
  userId: number;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  userAgent: string;
  isCurrent: boolean;
  lastUsed: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  currentSession: SessionData | null;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private prisma: DatabaseService,
    private jwt: JwtService,
    private config: ConfigService,
    private deviceDetection: DeviceDetectionService,
  ) {}

  /**
   * Create a new session for a user
   */
  async createSession(
    userId: number,
    tokenId: string,
    req: Request,
    deviceInfo?: DeviceInfo,
  ): Promise<SessionData> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Mark all other sessions as not current
    await this.prisma.session.updateMany({
      where: { userId, isActive: true },
      data: { isCurrent: false },
    });

    // Detect device info if not provided
    const detectedDeviceInfo = deviceInfo || this.deviceDetection.detectDevice(req);

    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenId,
        deviceInfo: detectedDeviceInfo as any,
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'Unknown',
        expiresAt,
        isCurrent: true,
      },
    });

    // Log session creation
    await this.logSessionActivity(session.id, 'LOGIN', req);

    this.logger.log(`New session created for user ${userId}: ${session.id}`);
    return this.mapSessionToData(session);
  }

  /**
   * Validate and refresh a session
   */
  async validateSession(tokenId: string, req: Request): Promise<SessionData | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenId, isActive: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    // Update last used timestamp
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastUsed: new Date() },
    });

    // Log session activity
    await this.logSessionActivity(session.id, 'REFRESH', req);

    return this.mapSessionToData(session);
  }

  /**
   * Get all active sessions for a user
   * Returns only the most recent session per unique device (browser + OS + IP)
   */
  async getUserSessions(userId: number): Promise<SessionData[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsed: 'desc' },
    });

    const mappedSessions = sessions.map(session => this.mapSessionToData(session));

    // Group sessions by device signature (browser + OS + IP) and keep only the most recent one
    const deviceMap = new Map<string, SessionData>();
    
    for (const session of mappedSessions) {
      const deviceInfo = session.deviceInfo || {};
      const browser = (deviceInfo as any)?.browser || 'Unknown';
      const os = (deviceInfo as any)?.os || 'Unknown';
      const ip = session.ipAddress || 'Unknown';
      
      // Create a unique device signature
      const deviceSignature = `${browser}-${os}-${ip}`;
      
      // Keep only the most recent session for each device
      const existing = deviceMap.get(deviceSignature);
      if (!existing || new Date(session.lastUsed) > new Date(existing.lastUsed)) {
        deviceMap.set(deviceSignature, session);
      }
    }

    // Convert map values back to array and sort by lastUsed descending
    const uniqueSessions = Array.from(deviceMap.values());
    uniqueSessions.sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());

    return uniqueSessions;
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: string, userId: number): Promise<SessionData | null> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, isActive: true },
    });

    return session ? this.mapSessionToData(session) : null;
  }

  /**
   * Get session by tokenId
   */
  async getSessionByTokenId(tokenId: string): Promise<SessionData | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenId, isActive: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return this.mapSessionToData(session);
  }

  /**
   * Update session last used timestamp
   */
  async updateSessionLastUsed(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastUsed: new Date() },
    });
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string, userId: number): Promise<boolean> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, isActive: true },
    });

    if (!session) {
      return false;
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    // Log session revocation
    await this.logSessionActivity(sessionId, 'LOGOUT', null);

    this.logger.log(`Session revoked: ${sessionId} for user ${userId}`);
    return true;
  }

  /**
   * Revoke all sessions for a user (except current)
   */
  async revokeAllOtherSessions(userId: number, currentSessionId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        isActive: true,
        id: { not: currentSessionId },
      },
      data: { isActive: false },
    });

    this.logger.log(`Revoked ${result.count} sessions for user ${userId}`);
    return result.count;
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: number): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    this.logger.log(`Revoked all ${result.count} sessions for user ${userId}`);
    return result.count;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        isActive: true,
      },
      data: { isActive: false },
    });

    this.logger.log(`Cleaned up ${result.count} expired sessions`);
    return result.count;
  }

  /**
   * Detect suspicious session activity
   */
  async detectSuspiciousActivity(sessionId: string, req: Request): Promise<boolean> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) return false;

    const currentIp = req.ip || req.connection.remoteAddress;
    const currentUserAgent = req.get('User-Agent');

    // Check for IP address change
    if (session.ipAddress !== currentIp) {
      await this.logSessionActivity(sessionId, 'SUSPICIOUS_ACTIVITY', req, {
        reason: 'IP_ADDRESS_CHANGE',
        oldIp: session.ipAddress,
        newIp: currentIp,
      });
      return true;
    }

    // Check for significant user agent change
    if (session.userAgent !== currentUserAgent) {
      await this.logSessionActivity(sessionId, 'SUSPICIOUS_ACTIVITY', req, {
        reason: 'USER_AGENT_CHANGE',
        oldUserAgent: session.userAgent,
        newUserAgent: currentUserAgent,
      });
      return true;
    }

    return false;
  }

  /**
   * Get session statistics for a user
   */
  async getSessionStats(userId: number): Promise<SessionStats> {
    const [totalSessions, activeSessions, currentSession] = await Promise.all([
      this.prisma.session.count({ where: { userId } }),
      this.prisma.session.count({
        where: { userId, isActive: true, expiresAt: { gt: new Date() } },
      }),
      this.prisma.session.findFirst({
        where: { userId, isActive: true, isCurrent: true },
      }),
    ]);

    return {
      totalSessions,
      activeSessions,
      currentSession: currentSession ? this.mapSessionToData(currentSession) : null,
    };
  }

  /**
   * Get session activity history
   */
  async getSessionActivity(sessionId: string, limit: number = 50): Promise<any[]> {
    return this.prisma.sessionActivity.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Generate a unique token ID
   */
  generateTokenId(): string {
    return crypto.randomUUID();
  }

  /**
   * Log session activity
   */
  private async logSessionActivity(
    sessionId: string,
    action: string,
    req: Request | null,
    details?: any,
  ): Promise<void> {
    try {
      await this.prisma.sessionActivity.create({
        data: {
          sessionId,
          action,
          ipAddress: req?.ip || req?.connection.remoteAddress,
          userAgent: req?.get('User-Agent'),
          details,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log session activity: ${error.message}`);
    }
  }

  /**
   * Map database session to SessionData
   */
  private mapSessionToData(session: any): SessionData {
    return {
      id: session.id,
      userId: session.userId,
      deviceInfo: session.deviceInfo || {},
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      isCurrent: session.isCurrent,
      lastUsed: session.lastUsed,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }

  /**
   * Check if session is valid and not expired
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    return session ? session.isActive && session.expiresAt > new Date() : false;
  }

  /**
   * Extend session expiration
   */
  async extendSession(sessionId: string, userId: number, additionalDays: number = 7): Promise<boolean> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, isActive: true },
    });

    if (!session) {
      return false;
    }

    const newExpiry = new Date(Date.now() + additionalDays * 24 * 60 * 60 * 1000);
    
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { expiresAt: newExpiry },
    });

    this.logger.log(`Extended session ${sessionId} for ${additionalDays} days`);
    return true;
  }
}
