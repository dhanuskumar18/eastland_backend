import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private mailerService: MailerService) {}

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
                <li>This OTP is valid for 10 minutes only</li>
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

}
