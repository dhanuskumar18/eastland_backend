import { Body, Controller, Post, UseGuards, Res, Req, ForbiddenException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthDto, SignupDto, ForgotPasswordDto, ResetPasswordDto, VerifyOtpDto } from "./dto";
import { JwtGuard } from "./guard";
import { GetUser } from "./decorator";
import { Throttle, SkipThrottle } from "@nestjs/throttler";
import type { Response, Request } from "express";

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService){}

    @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 attempts per minute for login
    @Post('login')
    async signin(@Body() dto: AuthDto, @Res() res: Response){
        try {
            const result = await this.authService.signin(dto, res);
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
    async signup(@Body() dto: SignupDto, @Res() res: Response){
        try {
            const result = await this.authService.signup(dto, res);
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
                return res.status(403).json({
                    message: 'No refresh token found',
                    statusCode: 403
                });
            }
            const result = await this.authService.refreshToken(refreshToken, res);
            return res.json(result);
        } catch (error) {
            return res.status(error.status || 500).json({
                message: error.message || 'Internal server error',
                statusCode: error.status || 500
            });
        }
    }

    @UseGuards(JwtGuard)
    @SkipThrottle() // Skip rate limiting for logout as user is already authenticated
    @Post('logout')
    async logout(@GetUser('id') userId: number, @Res() res: Response){
        try {
            const result = await this.authService.logout(userId, res);
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
}