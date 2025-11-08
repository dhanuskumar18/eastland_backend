import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, IsEnum, IsInt } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(32)
  password: string;

  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;
}


