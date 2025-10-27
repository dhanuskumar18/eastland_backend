import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtModule } from "@nestjs/jwt";
import { JwtStrategy } from "./strategy";
import { EmailService } from "./email.service";
import { MailerModule } from "@nestjs-modules/mailer";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
    imports:[
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (config: ConfigService) => ({
                secret: config.get('JWT_SECRET'),
                signOptions: { expiresIn: '15m' },
            }),
            inject: [ConfigService],
        }),
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
    controllers:[AuthController],
    providers:[AuthService, JwtStrategy, EmailService],
})
export class AuthModule {}
