import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuthDto, SignupDto, TokenResponseDto, ForgotPasswordDto, ResetPasswordDto, VerifyOtpDto } from './dto';
import * as argon from '@node-rs/argon2';
import { DatabaseService } from 'src/database/database.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import type { Response } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private prisma: DatabaseService,
    private jwt: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
  ) {}
  async signin(dto: AuthDto, res: Response) {
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
    return this.signTokenWithCookie(user.id, user.email, user.role.name, res);
   }

    async signTokenWithCookie(userId: number, email: string, role: string, res: Response): Promise<TokenResponseDto> {
      const payload = {
        sub: userId,
        email,
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

      // Hash and store refresh token in database
      const hashedRefreshToken = await argon.hash(refreshToken);
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshToken: hashedRefreshToken },
      });

      // Set refresh token in HTTP-only cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return {
        access_token: accessToken,
        role: role,
      };
    }



  async signup(dto: SignupDto, res: Response) {
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
        select: {
          id: true,
          email: true,
          role: {
            select: {
              name: true,
            },
          },
        },
      });
      return this.signTokenWithCookie(user.id, user.email, user.role.name, res);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ForbiddenException('Credentials taken');
        }
      }
      throw error;
    }
  }

  async refreshToken(refreshToken: string, res: Response): Promise<TokenResponseDto> {
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

      if (!user || !user.refreshToken) {
        throw new ForbiddenException('Invalid refresh token');
      }

      // Verify the refresh token matches the stored hash
      const refreshTokenMatches = await argon.verify(user.refreshToken, refreshToken);
      if (!refreshTokenMatches) {
        throw new ForbiddenException('Invalid refresh token');
      }

      // Generate new tokens
      return this.signTokenWithCookie(user.id, user.email, user.role.name, res);
    } catch (error) {
      throw new ForbiddenException('Invalid refresh token');
    }
  }

  async logout(userId: number, res: Response): Promise<{ message: string }> {
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

    return { message: 'Logged out successfully' };
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
}
