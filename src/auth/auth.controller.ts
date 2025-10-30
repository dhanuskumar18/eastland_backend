import { Body, Controller, Post, UseGuards, Res, Req, ForbiddenException, Get } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthDto, SignupDto, ForgotPasswordDto, ResetPasswordDto, VerifyOtpDto } from "./dto";
import { JwtGuard } from "./guard";
import { GetUser } from "./decorator";
import { Throttle, SkipThrottle } from "@nestjs/throttler";
import { CsrfService, SkipCsrf } from "./csrf";
import type { Response, Request } from "express";

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private csrfService: CsrfService
    ){}

    @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 attempts per minute for login
    @Post('login')
    async signin(@Body() dto: AuthDto, @Res() res: Response, @Req() req: Request){
        try {
            const result = await this.authService.signin(dto, res, req);
            return res.json(result);
        } catch (error) {
            return res.status(error.status || 500).json({
                message: error.message || 'Internal server error',
                statusCode: error.status || 500
            });
        }
    }

    @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 attempts per minute for signup
    @Post('signup')
    async signup(@Body() dto: SignupDto, @Res() res: Response, @Req() req: Request){
        try {
            const result = await this.authService.signup(dto, res, req);
            return res.json(result);
        } catch (error) {
            return res.status(error.status || 500).json({
                message: error.message || 'Internal server error',
                statusCode: error.status || 500
            });
        }
    }

    @Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 attempts per minute for refresh
    @Post('refresh')
    async refresh(@Req() req: Request, @Res() res: Response){
        try {
            const refreshToken = req.cookies?.refreshToken;
            if (!refreshToken) {
                // Clear any potentially invalid refresh token cookie
                this.clearRefreshTokenCookie(res);
                
                return res.status(401).json({
                    message: 'No refresh token found. Please log in again.',
                    statusCode: 401,
                    error: 'UNAUTHORIZED',
                    requiresLogin: true
                });
            }
            
            const result = await this.authService.refreshToken(refreshToken, res);
            return res.json(result);
        } catch (error) {
            // Clear invalid refresh token cookie on any error
            this.clearRefreshTokenCookie(res);
            
            // Handle specific error types
            if (error.status === 403) {
                return res.status(401).json({
                    message: error.message || 'Invalid or expired refresh token. Please log in again.',
                    statusCode: 401,
                    error: 'UNAUTHORIZED',
                    requiresLogin: true
                });
            }
            
            return res.status(error.status || 500).json({
                message: error.message || 'Internal server error',
                statusCode: error.status || 500,
                error: error.status ? 'UNAUTHORIZED' : 'INTERNAL_SERVER_ERROR',
                requiresLogin: error.status === 401 || error.status === 403
            });
        }
    }

    @UseGuards(JwtGuard)
    @SkipThrottle() // Skip rate limiting for logout as user is already authenticated
    @Post('logout')
    async logout(@GetUser('id') userId: number, @GetUser('sessionId') sessionId: string, @Res() res: Response){
        try {
            const result = await this.authService.logout(userId, res, sessionId);
            return res.json(result);
        } catch (error) {
            return res.status(error.status || 500).json({
                message: error.message || 'Internal server error',
                statusCode: error.status || 500
            });
        }
    }

    @Throttle({ short: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes for forgot password
    @Post('forgot-password')
    forgotPassword(@Body() dto: ForgotPasswordDto){
        return this.authService.forgotPassword(dto);
    }

    @Throttle({ short: { limit: 5, ttl: 300000 } }) // 5 attempts per 5 minutes for OTP verification
    @Post('verify-otp')
    verifyOtp(@Body() dto: VerifyOtpDto){
        return this.authService.verifyOtp(dto);
    }

    @Throttle({ short: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes for password reset
    @Post('reset-password')
    resetPassword(@Body() dto: ResetPasswordDto){
        return this.authService.resetPassword(dto);
    }

    // CSRF Token Management Endpoints

    /**
     * Get a new CSRF token for anonymous users
     */
    @SkipCsrf()
    @Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 requests per minute
    @Get('csrf-token')
    async getCsrfToken(@Req() req: Request, @Res() res: Response) {
        try {
            const token = await this.csrfService.generateToken();
            return res.json({ csrfToken: token });
        } catch (error) {
            return res.status(500).json({
                message: 'Failed to generate CSRF token',
                statusCode: 500
            });
        }
    }

    /**
     * Get a new CSRF token for authenticated users
     */
    @UseGuards(JwtGuard)
    @SkipCsrf()
    @Throttle({ short: { limit: 20, ttl: 60000 } }) // 20 requests per minute for authenticated users
    @Get('csrf-token/authenticated')
    async getAuthenticatedCsrfToken(
        @GetUser('id') userId: number,
        @GetUser('sessionId') sessionId: string,
        @Res() res: Response
    ) {
        try {
            const token = await this.csrfService.generateToken(sessionId, userId);
            return res.json({ csrfToken: token });
        } catch (error) {
            return res.status(500).json({
                message: 'Failed to generate CSRF token',
                statusCode: 500
            });
        }
    }

    /**
     * Get CSRF token with double-submit cookie pattern
     */
    @SkipCsrf()
    @Throttle({ short: { limit: 10, ttl: 60000 } })
    @Get('csrf-token/double-submit')
    async getDoubleSubmitCsrfToken(@Req() req: Request, @Res() res: Response) {
        try {
            const sessionId = this.extractSessionId(req);
            const userId = this.extractUserId(req);
            
            const { token, cookieValue } = await this.csrfService.createDoubleSubmitCookie(sessionId, userId);
            
            // Set the CSRF cookie
            res.cookie('csrf-token', cookieValue, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 30 * 60 * 1000, // 30 minutes
            });

            return res.json({ csrfToken: token });
        } catch (error) {
            return res.status(500).json({
                message: 'Failed to generate CSRF token',
                statusCode: 500
            });
        }
    }

    /**
     * Validate a CSRF token
     */
    @SkipCsrf()
    @Throttle({ short: { limit: 30, ttl: 60000 } })
    @Post('csrf-token/validate')
    async validateCsrfToken(@Body() body: { token: string }, @Req() req: Request, @Res() res: Response) {
        try {
            const { token } = body;
            if (!token) {
                return res.status(400).json({
                    message: 'CSRF token is required',
                    statusCode: 400
                });
            }

            const sessionId = this.extractSessionId(req);
            const userId = this.extractUserId(req);
            
            const isValid = await this.csrfService.validateToken(token, sessionId, userId);
            
            return res.json({ 
                valid: isValid,
                message: isValid ? 'Token is valid' : 'Token is invalid or expired'
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Failed to validate CSRF token',
                statusCode: 500
            });
        }
    }

    /**
     * Revoke all CSRF tokens for current session
     */
    @UseGuards(JwtGuard)
    @SkipCsrf()
    @Throttle({ short: { limit: 5, ttl: 60000 } })
    @Post('csrf-token/revoke-session')
    async revokeSessionCsrfTokens(
        @GetUser('sessionId') sessionId: string,
        @Res() res: Response
    ) {
        try {
            const count = await this.csrfService.revokeSessionTokens(sessionId);
            return res.json({ 
                message: `Revoked ${count} CSRF tokens for current session`,
                revokedCount: count
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Failed to revoke CSRF tokens',
                statusCode: 500
            });
        }
    }

    /**
     * Revoke all CSRF tokens for current user
     */
    @UseGuards(JwtGuard)
    @SkipCsrf()
    @Throttle({ short: { limit: 3, ttl: 60000 } })
    @Post('csrf-token/revoke-all')
    async revokeAllCsrfTokens(
        @GetUser('id') userId: number,
        @Res() res: Response
    ) {
        try {
            const count = await this.csrfService.revokeUserTokens(userId);
            return res.json({ 
                message: `Revoked ${count} CSRF tokens for user`,
                revokedCount: count
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Failed to revoke CSRF tokens',
                statusCode: 500
            });
        }
    }

    // Helper methods for extracting session and user info
    private extractSessionId(req: Request): string | undefined {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.substring(7);
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                return payload.sessionId || payload.jti;
            } catch (error) {
                // Token parsing failed
            }
        }
        return undefined;
    }

    private extractUserId(req: Request): number | undefined {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.substring(7);
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                return payload.sub;
            } catch (error) {
                // Token parsing failed
            }
        }
        return (req as any).user?.id;
    }

    /**
     * Helper method to clear refresh token cookie
     */
    private clearRefreshTokenCookie(res: Response): void {
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
        });
    }
}