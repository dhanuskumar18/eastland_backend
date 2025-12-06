import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, IsEnum, IsOptional } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class CreateUserDto {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Name must be a string' })
  name: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @IsOptional()
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(32, { message: 'Password must not exceed 32 characters' })
  password?: string;

  @IsNotEmpty({ message: 'Role is required' })
  @IsString({ message: 'Role must be a string' })
  @MinLength(2, { message: 'Role name must be at least 2 characters' })
  @MaxLength(50, { message: 'Role name must not exceed 50 characters' })
  role: string;

  @IsOptional()
  @IsEnum(UserStatus, {
    message: 'Status must be either ACTIVE or INACTIVE',
  })
  status?: UserStatus;
}


