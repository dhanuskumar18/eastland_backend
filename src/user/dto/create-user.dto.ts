import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, IsEnum, IsOptional } from 'class-validator';
import { UserRole, UserStatus } from '@prisma/client';

export class CreateUserDto {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Name must be a string' })
  name: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(32, { message: 'Password must not exceed 32 characters' })
  password: string;

  @IsNotEmpty({ message: 'Role is required' })
  @IsEnum(UserRole, {
    message: 'Role must be either USER or ADMIN',
  })
  role: UserRole;

  @IsOptional()
  @IsEnum(UserStatus, {
    message: 'Status must be either ACTIVE or INACTIVE',
  })
  status?: UserStatus;
}


