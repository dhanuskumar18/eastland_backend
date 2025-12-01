import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  MaxLength,
  IsUrl,
  IsEnum,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum RobotsDirective {
  INDEX_FOLLOW = 'index, follow',
  INDEX_NOFOLLOW = 'index, nofollow',
  NOINDEX_FOLLOW = 'noindex, follow',
  NOINDEX_NOFOLLOW = 'noindex, nofollow',
}

export class CreatePageSeoDto {
  @IsInt()
  @Type(() => Number)
  @IsNotEmpty({ message: 'Page ID is required' })
  pageId: number;

  @IsString()
  @IsNotEmpty({ message: 'Meta title is required' })
  @MaxLength(60, { message: 'Meta title must not exceed 60 characters' })
  metaTitle: string;

  @IsString()
  @IsNotEmpty({ message: 'Meta description is required' })
  @MaxLength(160, {
    message: 'Meta description must not exceed 160 characters',
  })
  metaDescription: string;

  @IsString()
  @IsOptional()
  metaKeywords?: string;

  @IsString()
  @IsOptional()
  @IsUrl({}, { message: 'Canonical URL must be a valid URL' })
  @MaxLength(500, {
    message: 'Canonical URL must not exceed 500 characters',
  })
  canonicalUrl?: string;

  @IsString()
  @IsOptional()
  @IsEnum(RobotsDirective, {
    message:
      'Robots directive must be one of: index, follow; index, nofollow; noindex, follow; noindex, nofollow',
  })
  robots?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  structuredData?: Record<string, any>;
}

