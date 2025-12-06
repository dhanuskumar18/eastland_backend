import { IsEmail, IsOptional, IsString, IsEnum, MinLength, MaxLength } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MinLength(2, { message: 'Role name must be at least 2 characters' })
  @MaxLength(50, { message: 'Role name must not exceed 50 characters' })
  role?: string;

  @IsEnum(UserStatus, {
    message: 'Status must be either ACTIVE or INACTIVE',
  })
  @IsOptional()
  status?: UserStatus;
}


