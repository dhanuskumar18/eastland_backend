import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import { IsString, IsInt, IsArray, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  categoryId?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  brandId?: number;

  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  @IsOptional()
  tagIds?: number[];

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  isActive?: boolean;
}

