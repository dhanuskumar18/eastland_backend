import { IsEmail, IsOptional, IsString, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(UserRole, {
    message: 'Role must be either USER or ADMIN',
  })
  @IsOptional()
  role?: UserRole;
}


