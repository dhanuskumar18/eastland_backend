import { IsOptional, IsString, IsIn } from 'class-validator';

export class OptimizeImageDto {
  @IsOptional()
  @IsString()
  @IsIn(['low', 'medium', 'high', 'maximum'])
  compressionLevel?: string;

  @IsOptional()
  @IsString()
  @IsIn(['webp', 'jpeg', 'jpg', 'png', 'avif'])
  format?: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  metaKeywords?: string;

  @IsOptional()
  @IsString()
  caption?: string;
}

