import { PartialType } from '@nestjs/mapped-types';
import { CreateYouTubeVideoDto } from './create-youtube-video.dto';
import { IsString, IsArray, IsOptional, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class UpdateYouTubeVideoDto extends PartialType(CreateYouTubeVideoDto) {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  youtubeLink?: string;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  brandId?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  categoryId?: number;

  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  @IsOptional()
  tagIds?: number[];

  @IsString()
  @IsOptional()
  imageUrl?: string;
}

