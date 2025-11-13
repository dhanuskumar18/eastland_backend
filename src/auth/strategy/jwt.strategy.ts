import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { DatabaseService } from "src/database/database.service";
import { SessionService } from "../../session/session.service";
import { Request } from "express";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        config: ConfigService,
        private prisma: DatabaseService,
        private sessionService: SessionService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: config.get('JWT_SECRET'),
            passReqToCallback: true, // Enable request access
        });
    }

    async validate(req: Request, payload: { sub: number; email: string; jti?: string }) {
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            include: { role: true },
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        // Check if user status is INACTIVE
        // Note: This check happens here, but UserStatusGuard will also check on every request
        // for real-time status updates
        if (user.status === 'INACTIVE') {
            throw new UnauthorizedException({
                success: false,
                message: 'Your account has been deactivated. Please contact administrator.',
                code: 'USER_INACTIVE',
                status: 'INACTIVE',
            });
        }

        // If JWT has a token ID, validate the session
        if (payload.jti) {
            const session = await this.sessionService.validateSession(payload.jti, req);
            if (!session) {
                throw new UnauthorizedException('Invalid or expired session');
            }

            // Check for suspicious activity
            const isSuspicious = await this.sessionService.detectSuspiciousActivity(
                session.id,
                req,
            );
            
            if (isSuspicious) {
                // Log suspicious activity but don't block the request
                // You can implement additional security measures here
                console.warn(`Suspicious activity detected for session ${session.id}`);
            }
        }

        // Add session info to user object for easy access
        return {
            ...user,
            sessionId: payload.jti,
        };
    }
}