import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {}

  async sendOtpEmail(email: string, otp: string): Promise<void> {
    try {
      this.logger.log(`Attempting to send OTP email to: ${email}`);
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Password Reset OTP</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background-color: #f4f4f4;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px;
                }
                .otp-code {
                    background-color: #007bff;
                    color: white;
                    padding: 15px;
                    text-align: center;
                    font-size: 24px;
                    font-weight: bold;
                    border-radius: 5px;
                    margin: 20px 0;
                    letter-spacing: 3px;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    font-size: 12px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Password Reset Request</h1>
            </div>
            
            <p>Hello,</p>
            
            <p>You have requested to reset your password. Please use the following One-Time Password (OTP) to complete the password reset process:</p>
            
            <div class="otp-code">
                ${otp}
            </div>
            
            <p><strong>Important:</strong></p>
            <ul>
                <li>This OTP is valid for 1 hour only</li>
                <li>Do not share this OTP with anyone</li>
                <li>If you did not request this password reset, please ignore this email</li>
            </ul>
            
            <p>If you have any questions, please contact our support team.</p>
            
            <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
            </div>
        </body>
        </html>
      `;
      
      await this.mailerService.sendMail({
        to: email,
        subject: 'Password Reset OTP',
        html: htmlContent,
      });
      
      this.logger.log(`OTP email sent successfully to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}:`, error);
      throw error;
    }
  }

  async sendPasswordResetConfirmation(email: string): Promise<void> {
    try {
      this.logger.log(`Attempting to send confirmation email to: ${email}`);
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Password Reset Successful</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background-color: #28a745;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px;
                }
                .success-icon {
                    font-size: 48px;
                    margin-bottom: 10px;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    font-size: 12px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="success-icon">✓</div>
                <h1>Password Reset Successful</h1>
            </div>
            
            <p>Hello,</p>
            
            <p>Your password has been successfully reset. You can now log in to your account using your new password.</p>
            
            <p><strong>Security Tips:</strong></p>
            <ul>
                <li>Keep your password secure and don't share it with anyone</li>
                <li>Use a strong, unique password</li>
                <li>Consider enabling two-factor authentication if available</li>
                <li>Log out from all devices if you suspect unauthorized access</li>
            </ul>
            
            <p>If you did not reset your password, please contact our support team immediately.</p>
            
            <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
            </div>
        </body>
        </html>
      `;
      
      await this.mailerService.sendMail({
        to: email,
        subject: 'Password Reset Successful',
        html: htmlContent,
      });
      
      this.logger.log(`Confirmation email sent successfully to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send confirmation email to ${email}:`, error);
      throw error;
    }
  }

  async sendPasswordChangeNotification(email: string, deviceInfo?: { browser?: string; os?: string; device?: string; ipAddress?: string }): Promise<void> {
    try {
      this.logger.log(`Attempting to send password change notification to: ${email}`);
      
      const deviceDetails = deviceInfo 
        ? `${deviceInfo.browser || 'Unknown'} on ${deviceInfo.os || 'Unknown OS'}${deviceInfo.device ? ` (${deviceInfo.device})` : ''}`
        : 'your account';
      const locationInfo = deviceInfo?.ipAddress ? ` from IP: ${deviceInfo.ipAddress}` : '';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Password Changed</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background-color: #ffc107;
                    color: #333;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px;
                }
                .info-box {
                    background-color: #f8f9fa;
                    border-left: 4px solid #ffc107;
                    padding: 15px;
                    margin: 20px 0;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    font-size: 12px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Password Changed</h1>
            </div>
            
            <p>Hello,</p>
            
            <p>Your password was successfully changed${locationInfo ? locationInfo : ''}.</p>
            
            <div class="info-box">
                <p><strong>Change Details:</strong></p>
                <ul>
                    <li>Device: ${deviceDetails}</li>
                    <li>Time: ${new Date().toLocaleString()}</li>
                </ul>
            </div>
            
            <p><strong>Important:</strong></p>
            <ul>
                <li>If you did not make this change, please contact support immediately</li>
                <li>Your account has been logged out from all devices for security</li>
                <li>You will need to log in again with your new password</li>
            </ul>
            
            <div class="footer">
                <p>This is an automated security notification. Please do not reply to this email.</p>
            </div>
        </body>
        </html>
      `;
      
      await this.mailerService.sendMail({
        to: email,
        subject: 'Password Changed - Security Notification',
        html: htmlContent,
      });
      
      this.logger.log(`Password change notification sent successfully to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password change notification to ${email}:`, error);
      // Don't throw - email failure shouldn't block password change
    }
  }

  async sendEmailChangeNotification(oldEmail: string, newEmail: string, deviceInfo?: { browser?: string; os?: string; device?: string; ipAddress?: string }): Promise<void> {
    try {
      this.logger.log(`Attempting to send email change notification to: ${oldEmail} and ${newEmail}`);
      
      const deviceDetails = deviceInfo 
        ? `${deviceInfo.browser || 'Unknown'} on ${deviceInfo.os || 'Unknown OS'}${deviceInfo.device ? ` (${deviceInfo.device})` : ''}`
        : 'your account';
      const locationInfo = deviceInfo?.ipAddress ? ` from IP: ${deviceInfo.ipAddress}` : '';

      // Send to old email
      const oldEmailContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Email Address Changed</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background-color: #ffc107;
                    color: #333;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px;
                }
                .info-box {
                    background-color: #f8f9fa;
                    border-left: 4px solid #ffc107;
                    padding: 15px;
                    margin: 20px 0;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    font-size: 12px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Email Address Changed</h1>
            </div>
            
            <p>Hello,</p>
            
            <p>Your account email address has been changed from <strong>${oldEmail}</strong> to <strong>${newEmail}</strong>${locationInfo ? locationInfo : ''}.</p>
            
            <div class="info-box">
                <p><strong>Change Details:</strong></p>
                <ul>
                    <li>Old Email: ${oldEmail}</li>
                    <li>New Email: ${newEmail}</li>
                    <li>Device: ${deviceDetails}</li>
                    <li>Time: ${new Date().toLocaleString()}</li>
                </ul>
            </div>
            
            <p><strong>Important:</strong></p>
            <ul>
                <li>If you did not make this change, please contact support immediately</li>
                <li>Future notifications will be sent to your new email address</li>
            </ul>
            
            <div class="footer">
                <p>This is an automated security notification. Please do not reply to this email.</p>
            </div>
        </body>
        </html>
      `;

      // Send to new email
      const newEmailContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Email Address Changed</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background-color: #28a745;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px;
                }
                .info-box {
                    background-color: #f8f9fa;
                    border-left: 4px solid #28a745;
                    padding: 15px;
                    margin: 20px 0;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    font-size: 12px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Email Address Changed</h1>
            </div>
            
            <p>Hello,</p>
            
            <p>Your account email address has been successfully changed to <strong>${newEmail}</strong>${locationInfo ? locationInfo : ''}.</p>
            
            <div class="info-box">
                <p><strong>Change Details:</strong></p>
                <ul>
                    <li>Previous Email: ${oldEmail}</li>
                    <li>New Email: ${newEmail}</li>
                    <li>Device: ${deviceDetails}</li>
                    <li>Time: ${new Date().toLocaleString()}</li>
                </ul>
            </div>
            
            <p><strong>Important:</strong></p>
            <ul>
                <li>If you did not make this change, please contact support immediately</li>
                <li>All future notifications will be sent to this email address</li>
            </ul>
            
            <div class="footer">
                <p>This is an automated security notification. Please do not reply to this email.</p>
            </div>
        </body>
        </html>
      `;
      
      // Send to both emails
      await Promise.all([
        this.mailerService.sendMail({
          to: oldEmail,
          subject: 'Email Address Changed - Security Notification',
          html: oldEmailContent,
        }),
        this.mailerService.sendMail({
          to: newEmail,
          subject: 'Email Address Changed - Security Notification',
          html: newEmailContent,
        }),
      ]);
      
      this.logger.log(`Email change notifications sent successfully to: ${oldEmail} and ${newEmail}`);
    } catch (error) {
      this.logger.error(`Failed to send email change notification:`, error);
      // Don't throw - email failure shouldn't block email change
    }
  }

  async sendNewDeviceLoginNotification(email: string, deviceInfo: { browser?: string; os?: string; device?: string; ipAddress?: string }): Promise<void> {
    try {
      this.logger.log(`Attempting to send new device login notification to: ${email}`);
      
      const deviceDetails = `${deviceInfo.browser || 'Unknown'} on ${deviceInfo.os || 'Unknown OS'}${deviceInfo.device ? ` (${deviceInfo.device})` : ''}`;
      const locationInfo = deviceInfo.ipAddress || 'Unknown location';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>New Device Login</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background-color: #17a2b8;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px;
                }
                .info-box {
                    background-color: #f8f9fa;
                    border-left: 4px solid #17a2b8;
                    padding: 15px;
                    margin: 20px 0;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    font-size: 12px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>New Device Login Detected</h1>
            </div>
            
            <p>Hello,</p>
            
            <p>We detected a login to your account from a new device or location.</p>
            
            <div class="info-box">
                <p><strong>Login Details:</strong></p>
                <ul>
                    <li>Device: ${deviceDetails}</li>
                    <li>Location: ${locationInfo}</li>
                    <li>Time: ${new Date().toLocaleString()}</li>
                </ul>
            </div>
            
            <p><strong>Important:</strong></p>
            <ul>
                <li>If this was you, no action is needed</li>
                <li>If you don't recognize this login, please change your password immediately</li>
                <li>Consider enabling two-factor authentication for additional security</li>
            </ul>
            
            <div class="footer">
                <p>This is an automated security notification. Please do not reply to this email.</p>
            </div>
        </body>
        </html>
      `;
      
      await this.mailerService.sendMail({
        to: email,
        subject: 'New Device Login - Security Notification',
        html: htmlContent,
      });
      
      this.logger.log(`New device login notification sent successfully to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send new device login notification to ${email}:`, error);
      // Don't throw - email failure shouldn't block login
    }
  }

  async sendMfaEnabledNotification(email: string): Promise<void> {
    try {
      this.logger.log(`Attempting to send MFA enabled notification to: ${email}`);
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Two-Factor Authentication Enabled</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background-color: #28a745;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    font-size: 12px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Two-Factor Authentication Enabled</h1>
            </div>
            
            <p>Hello,</p>
            
            <p>Two-factor authentication (2FA) has been successfully enabled on your account.</p>
            
            <p><strong>What this means:</strong></p>
            <ul>
                <li>You will need to enter a verification code from your authenticator app when logging in</li>
                <li>Your account is now more secure</li>
                <li>You can disable 2FA anytime from your account settings</li>
            </ul>
            
            <p><strong>Important:</strong></p>
            <ul>
                <li>If you did not enable 2FA, please contact support immediately</li>
                <li>Keep your authenticator app secure</li>
            </ul>
            
            <div class="footer">
                <p>This is an automated security notification. Please do not reply to this email.</p>
            </div>
        </body>
        </html>
      `;
      
      await this.mailerService.sendMail({
        to: email,
        subject: 'Two-Factor Authentication Enabled - Security Notification',
        html: htmlContent,
      });
      
      this.logger.log(`MFA enabled notification sent successfully to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send MFA enabled notification to ${email}:`, error);
      // Don't throw - email failure shouldn't block MFA enable
    }
  }

  async sendMfaDisabledNotification(email: string): Promise<void> {
    try {
      this.logger.log(`Attempting to send MFA disabled notification to: ${email}`);
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Two-Factor Authentication Disabled</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background-color: #ffc107;
                    color: #333;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    font-size: 12px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Two-Factor Authentication Disabled</h1>
            </div>
            
            <p>Hello,</p>
            
            <p>Two-factor authentication (2FA) has been disabled on your account.</p>
            
            <p><strong>Important:</strong></p>
            <ul>
                <li>If you did not disable 2FA, please contact support immediately</li>
                <li>Your account security has been reduced</li>
                <li>Consider re-enabling 2FA for better security</li>
            </ul>
            
            <div class="footer">
                <p>This is an automated security notification. Please do not reply to this email.</p>
            </div>
        </body>
        </html>
      `;
      
      await this.mailerService.sendMail({
        to: email,
        subject: 'Two-Factor Authentication Disabled - Security Notification',
        html: htmlContent,
      });
      
      this.logger.log(`MFA disabled notification sent successfully to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send MFA disabled notification to ${email}:`, error);
      // Don't throw - email failure shouldn't block MFA disable
    }
  }

  async sendPasswordExpiryWarning(email: string, daysRemaining: number): Promise<void> {
    try {
      this.logger.log(`Attempting to send password expiry warning to: ${email}`);
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Password Expiry Warning</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background-color: #ffc107;
                    color: #333;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px;
                }
                .warning-box {
                    background-color: #fff3cd;
                    border-left: 4px solid #ffc107;
                    padding: 15px;
                    margin: 20px 0;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    font-size: 12px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Password Expiry Warning</h1>
            </div>
            
            <p>Hello,</p>
            
            <p>Your password will expire in ${daysRemaining} day(s). Please change your password soon to avoid being locked out of your account.</p>
            
            <div class="warning-box">
                <p><strong>Action Required:</strong></p>
                <p>Please change your password within the next ${daysRemaining} day(s) to maintain access to your account.</p>
            </div>
            
            <p>You can change your password from your account settings or profile page.</p>
            
            <div class="footer">
                <p>This is an automated security notification. Please do not reply to this email.</p>
            </div>
        </body>
        </html>
      `;
      
      await this.mailerService.sendMail({
        to: email,
        subject: `Password Expiry Warning - ${daysRemaining} Day(s) Remaining`,
        html: htmlContent,
      });
      
      this.logger.log(`Password expiry warning sent successfully to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password expiry warning to ${email}:`, error);
      // Don't throw - email failure shouldn't block operations
    }
  }

  async sendPasswordSetupEmail(email: string, name: string, token: string): Promise<void> {
    try {
      this.logger.log(`Attempting to send password setup email to: ${email}`);
      
      const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:5002';
      // URL encode the token to ensure it's properly formatted in the link
      const encodedToken = encodeURIComponent(token);
      const setupLink = `${frontendUrl}/auth/setup-password?token=${encodedToken}`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Eastland Distributors Admin Dashboard - Set Up Your Password</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f5f5f5;
                }
                .container {
                    background-color: white;
                    border-radius: 8px;
                    padding: 30px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .header {
                    background-color: #017850;
                    color: white;
                    padding: 25px;
                    text-align: center;
                    border-radius: 5px;
                    margin-bottom: 30px;
                }
                .header h1 {
                    margin: 0;
                    font-size: 24px;
                    font-weight: bold;
                }
                .header p {
                    margin: 10px 0 0 0;
                    font-size: 14px;
                    opacity: 0.95;
                }
                .button {
                    display: inline-block;
                    background-color: #2563eb;
                    color: white;
                    padding: 14px 35px;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 25px 0;
                    font-weight: bold;
                    font-size: 16px;
                    transition: background-color 0.3s;
                }
                .button:hover {
                    background-color: #1d4ed8;
                }
                .info-box {
                    background-color: #f8f9fa;
                    border-left: 4px solid #017850;
                    padding: 18px;
                    margin: 25px 0;
                    border-radius: 4px;
                }
                .info-box ul {
                    margin: 10px 0;
                    padding-left: 20px;
                }
                .info-box li {
                    margin: 8px 0;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    font-size: 12px;
                    color: #666;
                    text-align: center;
                }
                .link-text {
                    word-break: break-all;
                    color: #017850;
                    font-size: 13px;
                    margin: 15px 0;
                }
                .greeting {
                    font-size: 16px;
                    margin-bottom: 20px;
                }
                .content-text {
                    margin-bottom: 15px;
                    color: #555;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Eastland Distributors Admin Dashboard</h1>
                    <p>You've been invited to join our team</p>
                </div>
                
                <p class="greeting">Hello ${name || 'there'},</p>
                
                <p class="content-text">You have been invited to access the <strong>Eastland Distributors Admin Dashboard</strong>. Your account has been created and you're just one step away from getting started.</p>
                
                <p class="content-text">To complete your account setup and secure your access, please set up your password by clicking the button below:</p>
                
                <div style="text-align: center;">
                    <a href="${setupLink}" class="button">Set Up Your Password</a>
                </div>
                
                <p class="content-text" style="font-size: 14px; margin-top: 20px;">Or copy and paste this link into your browser:</p>
                <p class="link-text">${setupLink}</p>
                
                <div class="info-box">
                    <p style="margin-top: 0; font-weight: bold; color: #017850;">Important Information:</p>
                    <ul>
                        <li>This invitation link is valid for 24 hours from the time it was sent</li>
                        <li>Do not share this link with anyone - it's unique to your account</li>
                        <li>After setting your password, you'll be able to log in to the admin dashboard</li>
                        <li>If you did not expect this invitation, please contact our support team immediately</li>
                    </ul>
                </div>
                
                <p class="content-text">Once you've set your password, you can log in to the <strong>Eastland Distributors Admin Dashboard</strong> and start managing your account.</p>
                
                <p class="content-text" style="margin-top: 25px;">Welcome aboard!</p>
                
                <div class="footer">
                    <p><strong>Eastland Distributors</strong></p>
                    <p>This is an automated message. Please do not reply to this email.</p>
                    <p>If you have any questions, please contact our support team.</p>
                </div>
            </div>
        </body>
        </html>
      `;
      
      await this.mailerService.sendMail({
        to: email,
        subject: 'Eastland Distributors Admin Dashboard - Set Up Your Password',
        html: htmlContent,
      });
      
      this.logger.log(`Password setup email sent successfully to: ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password setup email to ${email}:`, error);
      throw error;
    }
  }

}
