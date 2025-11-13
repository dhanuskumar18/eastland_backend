import { IsString, IsNotEmpty, IsIn, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LazyLoadingSettingsDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['enable', 'disable'])
  enabled: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['all-images', 'page-images', 'product-images', 'gallery-images', 'custom'])
  whereToApply: string;

  @IsOptional()
  @IsString()
  metaKeywords?: string;

  @IsOptional()
  @IsString()
  preloadThreshold?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['lazy', 'eager', 'auto'])
  loadingAttribute: string;
}

export class SectionLazyLoadingItemDto {
  @IsNumber()
  @IsNotEmpty()
  sectionId: number;

  @IsBoolean()
  @IsNotEmpty()
  enabled: boolean;

  @IsString()
  @IsNotEmpty()
  @IsIn(['lazy', 'eager', 'auto'])
  loadingAttribute: string;

  @IsOptional()
  @IsString()
  preloadThreshold?: string;
}

export class SectionLazyLoadingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionLazyLoadingItemDto)
  sections: SectionLazyLoadingItemDto[];
}

