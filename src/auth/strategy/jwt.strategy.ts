import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { DatabaseService } from "src/database/database.service";
import { SessionService } from "../../session/session.service";
import { RolesService } from "../../roles/roles.service";
import { AbilityFactory } from "../../common/services/ability.factory";
import { Request } from "express";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        config: ConfigService,
        private prisma: DatabaseService,
        private sessionService: SessionService,
        private rolesService: RolesService,
        private abilityFactory: AbilityFactory,
    ) {
        super({
            // Security: Session tokens are NEVER extracted from URL parameters
            // Only from Authorization header to prevent leakage via logs, referers, and browser history
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            // Security: JWT secret stored in environment variable (JWT_SECRET), never hardcoded
            secretOrKey: config.get('JWT_SECRET'),
            passReqToCallback: true, // Enable request access
        });
    }

    async validate(req: Request, payload: { sub: number; email: string; jti?: string }) {
        // Security: Explicitly reject tokens from URL parameters
        // This prevents token leakage via logs, referers, and browser history
        if (req.query?.token || req.query?.access_token || req.query?.jwt) {
            throw new UnauthorizedException('Session tokens must not be passed in URL parameters');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            include: {
                role: {
                    include: {
                        permissions: {
                            include: {
                                permission: true,
                            },
                        },
                    },
                },
            },
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

        // Check if password has expired (90 days) - only if passwordChangedAt is set
        // If passwordChangedAt is null, allow access (user should change password)
        if (user.passwordChangedAt) {
            const now = new Date();
            const daysSinceChange = Math.floor((now.getTime() - user.passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24));
            const PASSWORD_EXPIRY_DAYS = 90;
            
            if (daysSinceChange >= PASSWORD_EXPIRY_DAYS) {
                throw new UnauthorizedException({
                    success: false,
                    message: 'Your password has expired. Please change your password to continue.',
                    code: 'PASSWORD_EXPIRED',
                    daysExpired: daysSinceChange - PASSWORD_EXPIRY_DAYS,
                });
            }
        }
        // If passwordChangedAt is null, allow access but user should change password
        // This handles existing users who haven't changed password yet

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

        // Create CASL ability for the user (this loads permissions internally)
        const ability = await this.abilityFactory.createForUser(user.id);

        // Set ability on request for easy access in guards and controllers
        req.ability = ability;

        // Add session info and CASL ability to user object
        return {
            ...user,
            sessionId: payload.jti,
            ability, // CASL ability object for authorization checks
        };
    }
}