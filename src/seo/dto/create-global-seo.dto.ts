import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateGlobalSeoDto {
  @IsString()
  @IsNotEmpty({ message: 'Site name is required' })
  @MaxLength(255, { message: 'Site name must not exceed 255 characters' })
  siteName: string;

  @IsString()
  @IsNotEmpty({ message: 'Default title is required' })
  @MaxLength(60, { message: 'Default title must not exceed 60 characters' })
  defaultTitle: string;

  @IsString()
  @IsNotEmpty({ message: 'Default description is required' })
  @MaxLength(160, {
    message: 'Default description must not exceed 160 characters',
  })
  defaultDescription: string;

  @IsString()
  @IsNotEmpty({ message: 'Default keywords is required' })
  defaultKeywords: string;

  @IsString()
  @IsOptional()
  @MaxLength(255, {
    message: 'Google site verification must not exceed 255 characters',
  })
  googleSiteVerification?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255, {
    message: 'Bing site verification must not exceed 255 characters',
  })
  bingSiteVerification?: string;

  @IsString()
  @IsOptional()
  robotsTxt?: string;
}

