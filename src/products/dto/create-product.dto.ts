import { IsString, IsInt, IsArray, IsOptional, IsNotEmpty, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  categoryId: number;

  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  brandId: number;

  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  @IsOptional()
  tagIds?: number[];

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  locale?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}

