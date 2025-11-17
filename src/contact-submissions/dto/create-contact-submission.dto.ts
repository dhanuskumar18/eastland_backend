import { IsString, IsNotEmpty, IsEmail, IsOptional, IsObject } from 'class-validator';

export class CreateContactSubmissionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsObject()
  @IsOptional()
  customFields?: Record<string, any>;
}

