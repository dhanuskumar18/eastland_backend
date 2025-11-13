import { IsString, IsArray, IsOptional, IsNotEmpty, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class CreateYouTubeVideoDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  youtubeLink: string;

  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  brandId: number;

  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  categoryId: number;

  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  @IsOptional()
  tagIds?: number[];

  @IsString()
  @IsOptional()
  locale?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}

