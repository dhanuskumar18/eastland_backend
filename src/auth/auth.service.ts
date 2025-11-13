import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuthDto, SignupDto, TokenResponseDto, ForgotPasswordDto, ResetPasswordDto, VerifyOtpDto } from './dto';
import * as argon from '@node-rs/argon2';
import { DatabaseService } from 'src/database/database.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { SessionService } from '../session/session.service';
import { DeviceDetectionService } from '../session/device-detection.service';
import type { Response, Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: DatabaseService,
    private jwt: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
    private sessionService: SessionService,
    private deviceDetection: DeviceDetectionService,
  ) {}
  async signin(dto: AuthDto, res: Response, req: Request) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
      include: {
        role: true,
      },
    });
    if (!user) {
      throw new ForbiddenException('Credentials incorrect');
    }
    const pwMatches = await argon.verify(user.password, dto.password);
    if (!pwMatches) {
      throw new ForbiddenException('Credentials incorrect');
    }

    // Check if user status is ACTIVE
    if (user.status === 'INACTIVE') {
      throw new ForbiddenException({
        message: 'Your account is inactive. Please contact administrator.',
        code: 'ACCOUNT_INACTIVE',
        status: 'INACTIVE',
      });
    }

    return this.signTokenWithCookie(user, res, req);
   }

    async signTokenWithCookie(user: { id: number; email: string; name: string | null; status: string; role: { name: string } }, res: Response, req?: Request): Promise<TokenResponseDto> {
      const tokenId = crypto.randomUUID(); // Generate unique token ID for session tracking
      const payload = {
        sub: user.id,
        email: user.email,
        jti: tokenId, // JWT ID for session tracking
      };
      
      // Generate access token (short-lived)
      const accessToken = await this.jwt.signAsync(payload, {
        expiresIn: '15m',
        secret: this.config.get('JWT_SECRET'),
      });

      // Generate refresh token (long-lived)
      const refreshToken = await this.jwt.signAsync(payload, {
        expiresIn: '7d',
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });

      // Create session if request is available
      if (req) {
        await this.sessionService.createSession(user.id, tokenId, req);
      }

      // Hash and store refresh token in database (for backward compatibility)
      const hashedRefreshToken = await argon.hash(refreshToken);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: hashedRefreshToken },
      });

      // Set refresh token in HTTP-only cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Parse name into firstName and lastName if available
      const nameParts = user.name ? user.name.split(' ') : [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        access_token: accessToken,
        role: user.role.name,
        status: user.status,
        userId: user.id,
        firstName: firstName,
        lastName: lastName,
      };
    }



  async signup(dto: SignupDto, res: Response, req: Request) {
    try {
      const hash = await argon.hash(dto.password);
      
      // Determine the role - default to 'USER' if not provided
      const roleName = dto.role || 'USER';
      
      // Find or create the specified role
      let role = await this.prisma.role.findFirst({
        where: { name: roleName },
      });
      
      if (!role) {
        role = await this.prisma.role.create({
          data: { name: roleName },
        });
      }
      
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          password: hash,
          roleId: role.id,
        },
        include: {
          role: true,
        },
      });
      return this.signTokenWithCookie(user, res, req);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ForbiddenException('Credentials taken');
        }
      }
      throw error;
    }
  }

  async refreshToken(refreshToken: string, res: Response, req?: Request): Promise<TokenResponseDto> {
    try {
      // Verify the refresh token
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });

      // Find user and verify stored refresh token
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          role: true,
        },
      });

      if (!user) {
        throw new ForbiddenException('User not found for refresh token');
      }

      // Check if user status is INACTIVE
      if (user.status === 'INACTIVE') {
        throw new ForbiddenException({
          message: 'Your account is inactive. Please contact administrator.',
          code: 'ACCOUNT_INACTIVE',
          status: 'INACTIVE',
        });
      }

      if (!user.refreshToken) {
        throw new ForbiddenException('No refresh token stored for user');
      }

      // Verify the refresh token matches the stored hash
      const refreshTokenMatches = await argon.verify(user.refreshToken, refreshToken);
      if (!refreshTokenMatches) {
        throw new ForbiddenException('Refresh token does not match stored token');
      }

      // Validate session by jti from the refresh token payload
      const tokenId = (payload as any)?.jti;
      if (!tokenId) {
        throw new ForbiddenException('Invalid refresh token (missing jti)');
      }

      const session = await this.sessionService.validateSession(tokenId, req as Request);
      if (!session) {
        throw new ForbiddenException('Session invalid or expired');
      }

      // Generate new tokens
      return this.signTokenWithCookie(user, res, req);
    } catch (error) {
      // Handle JWT verification errors specifically
      if (error.name === 'JsonWebTokenError') {
        throw new ForbiddenException('Invalid refresh token format');
      }
      
      if (error.name === 'TokenExpiredError') {
        throw new ForbiddenException('Refresh token has expired');
      }
      
      if (error.name === 'NotBeforeError') {
        throw new ForbiddenException('Refresh token not yet valid');
      }
      
      // Re-throw ForbiddenException as-is
      if (error instanceof ForbiddenException) {
        throw error;
      }
      
      // Handle any other errors
      throw new ForbiddenException('Invalid refresh token');
    }
  }


  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // For security, don't reveal if email exists or not
      return { message: 'If the email exists, an OTP has been sent' };
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash the OTP
    const hashedOtp = await argon.hash(otp);
    
    // Set OTP expiration (10 minutes from now)
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Create new OTP record
    await this.prisma.otp.create({
      data: {
        userId: user.id,
        code: hashedOtp,
        type: 'PASSWORD_RESET',
        expiresAt: otpExpiresAt,
      },
    });

    // Send OTP email
    try {
      await this.emailService.sendOtpEmail(dto.email, otp);
    } catch (error) {
      // If email fails, remove the OTP from database
      await this.prisma.otp.deleteMany({
        where: {
          userId: user.id,
          type: 'PASSWORD_RESET',
          expiresAt: { gte: new Date() }, // Only delete non-expired OTPs
        },
      });
      throw new BadRequestException('Failed to send OTP email');
    }

    return { message: 'If the email exists, an OTP has been sent' };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ message: string; verified: boolean }> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find valid OTP for password reset
    const validOtp = await this.prisma.otp.findFirst({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        isUsed: false,
        expiresAt: { gt: new Date() }, // Not expired
      },
      orderBy: { createdAt: 'desc' }, // Get the most recent OTP
    });

    if (!validOtp) {
      throw new BadRequestException('No valid OTP found. Please request a new one.');
    }

    // Verify OTP
    const otpMatches = await argon.verify(validOtp.code, dto.otp);
    if (!otpMatches) {
      throw new BadRequestException('Invalid OTP');
    }

    // Mark OTP as used
    await this.prisma.otp.update({
      where: { id: validOtp.id },
      data: { isUsed: true },
    });

    return { 
      message: 'OTP verified successfully. You can now reset your password.',
      verified: true 
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find valid used OTP for password reset (must be verified first)
    const usedOtp = await this.prisma.otp.findFirst({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        isUsed: true,
        expiresAt: { gt: new Date() }, // Not expired
      },
      orderBy: { createdAt: 'desc' }, // Get the most recent OTP
    });

    if (!usedOtp) {
      throw new BadRequestException('No valid verified OTP found. Please verify your OTP first.');
    }

    // Hash new password
    const hashedPassword = await argon.hash(dto.newPassword);

    // Update password and invalidate all refresh tokens
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        refreshToken: null, // Invalidate all refresh tokens
      },
    });

    // Clean up all OTPs for this user (used and unused)
    await this.prisma.otp.deleteMany({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
      },
    });

    // Send confirmation email
    try {
      await this.emailService.sendPasswordResetConfirmation(dto.email);
    } catch (error) {
      // Don't fail the password reset if email fails
      console.error('Failed to send confirmation email:', error);
    }

    return { message: 'Password reset successfully' };
  }

  // Session Management Methods

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: number) {
    return this.sessionService.getUserSessions(userId);
  }

  /**
   * Get session statistics for a user
   */
  async getSessionStats(userId: number) {
    return this.sessionService.getSessionStats(userId);
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string, userId: number) {
    return this.sessionService.revokeSession(sessionId, userId);
  }

  /**
   * Revoke all other sessions (keep current)
   */
  async revokeAllOtherSessions(userId: number, currentSessionId: string) {
    return this.sessionService.revokeAllOtherSessions(userId, currentSessionId);
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: number) {
    return this.sessionService.revokeAllUserSessions(userId);
  }

  /**
   * Get session activity history
   */
  async getSessionActivity(sessionId: string, limit: number = 50) {
    return this.sessionService.getSessionActivity(sessionId, limit);
  }

  /**
   * Extend session expiration
   */
  async extendSession(sessionId: string, userId: number, additionalDays: number = 7) {
    return this.sessionService.extendSession(sessionId, userId, additionalDays);
  }

  /**
   * Update logout method to handle session management
   */
  async logout(userId: number, res: Response, sessionId?: string): Promise<{ message: string }> {
    if (sessionId) {
      // Revoke specific session
      await this.sessionService.revokeSession(sessionId, userId);
    } else {
      // Revoke all sessions
      await this.sessionService.revokeAllUserSessions(userId);
    }

    // Remove refresh token from database
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    // Clear CSRF cookie (double-submit cookie)
    res.clearCookie('csrf-token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return { message: 'Logged out successfully' };
  }
}
