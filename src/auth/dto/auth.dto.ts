import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, IsOptional, IsEnum } from "class-validator";

export class AuthDto {
    @IsEmail()
    @IsNotEmpty()
    @IsString()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @MaxLength(32)
    password: string;
}

export class SignupDto extends AuthDto {
    @IsOptional()
    @IsEnum(['USER', 'ADMIN'], { message: 'Role must be either USER or ADMIN' })
    role?: 'USER' | 'ADMIN';
}

export class TokenResponseDto {
    access_token: string;
    role: string;
}

// RefreshTokenDto is no longer needed as we'll read from cookies
// export class RefreshTokenDto {
//     @IsString()
//     @IsNotEmpty()
//     refresh_token: string;
// }

export class ForgotPasswordDto {
    @IsEmail()
    @IsNotEmpty()
    @IsString()
    email: string;
}

export class VerifyOtpDto {
    @IsEmail()
    @IsNotEmpty()
    @IsString()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    @MaxLength(6)
    otp: string;
}

export class ResetPasswordDto {
    @IsEmail()
    @IsNotEmpty()
    @IsString()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @MaxLength(32)
    newPassword: string;
}
