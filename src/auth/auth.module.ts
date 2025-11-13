import { Module, forwardRef } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtModule } from "@nestjs/jwt";
import { JwtStrategy } from "./strategy";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { SessionModule } from "../session/session.module";
import { EmailModule } from "../email/email.module";
import { CsrfService } from "./csrf";
import { DatabaseModule } from "../database/database.module";

@Module({
    imports:[
        forwardRef(() => SessionModule), // Use forwardRef to break circular dependency
        EmailModule, // Import the email module
        DatabaseModule, // Import database module for UserStatusGuard
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (config: ConfigService) => ({
                secret: config.get('JWT_SECRET'),
                signOptions: { expiresIn: '15m' },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers:[AuthController],
    providers:[AuthService, JwtStrategy, CsrfService],
    exports: [CsrfService], // Export CSRF service for use in other modules
})
export class AuthModule {}
