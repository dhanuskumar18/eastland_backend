import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => {
        const mailConfig = {
          transport: {
            host: config.get('MAIL_HOST', 'smtp.gmail.com'),
            port: parseInt(config.get('MAIL_PORT', '587')),
            secure: false, // true for 465, false for other ports
            auth: {
              user: config.get('MAIL_USER'),
              pass: config.get('MAIL_PASS'),
            },
            tls: {
              rejectUnauthorized: false
            }
          },
          defaults: {
            from: `"No Reply" <${config.get('MAIL_FROM', 'noreply@example.com')}>`,
          },
        };
        
        return mailConfig;
      },
      inject: [ConfigService],
    }),
  ],
  providers: [EmailService],
  exports: [EmailService], // Export EmailService for use in other modules
})
export class EmailModule {}
