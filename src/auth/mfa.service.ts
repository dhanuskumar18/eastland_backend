import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { EmailService } from '../email/email.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as argon from '@node-rs/argon2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MfaService {
  constructor(
    private prisma: DatabaseService,
    private config: ConfigService,
    private emailService: EmailService,
  ) {}

  /**
   * Generate a new MFA secret for a user
   */
  async generateMfaSecret(userId: number, email: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get app name and issuer from config or use defaults
    const appName = this.config.get('MFA_APP_NAME') || 'Eastland Admin';
    const issuer = this.config.get('MFA_ISSUER') || 'Eastland Admin';

    // Generate a new secret with proper Google Authenticator format
    const secret = speakeasy.generateSecret({
      name: `${appName} (${email})`,
      issuer: issuer,
      length: 32,
    });

    // Store the secret temporarily (not enabled yet)
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret.base32 },
    });

    // Generate QR code with optimized settings for Google Authenticator
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl, // Base64 data URL of the QR code
      otpauthUrl: secret.otpauth_url, // Return the otpauth URL for reference
    };
  }

  /**
   * Enable MFA for a user after verifying the token
   */
  async enableMfa(userId: number, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.mfaSecret) {
      throw new BadRequestException('MFA secret not generated. Please generate a secret first.');
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: token,
      window: 2, // Allow 2 time steps (60 seconds) of tolerance
    });

    if (!verified) {
      throw new BadRequestException('Invalid verification code');
    }

    // Enable MFA
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });
    // Send MFA enabled notification
    try {
      await this.emailService.sendMfaEnabledNotification(user.email);
    } catch (error) {
      // Don't fail MFA enable if email fails
      console.error('Failed to send MFA enabled notification:', error);
    }

    return { message: 'MFA enabled successfully' };
  }

  /**
   * Disable MFA for a user
   */
  async disableMfa(userId: number, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify password
    const pwMatches = await argon.verify(user.password, password);
    if (!pwMatches) {
      throw new ForbiddenException('Invalid password');
    }

    // Disable MFA and clear secrets
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    // Send MFA disabled notification
    try {
      await this.emailService.sendMfaDisabledNotification(user.email);
    } catch (error) {
      // Don't fail MFA disable if email fails
      console.error('Failed to send MFA disabled notification:', error);
    }

    return { message: 'MFA disabled successfully' };
  }

  /**
   * Verify MFA token during login
   */
  async verifyMfaToken(userId: number, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return false;
    }

    // Verify TOTP token
    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: token,
      window: 2,
    });

    return verified;
  }

  /**
   * Get MFA status for a user
   */
  async getMfaStatus(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        mfaEnabled: true,
        mfaSecret: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      mfaEnabled: user.mfaEnabled,
      mfaSecretGenerated: !!user.mfaSecret,
    };
  }
}

