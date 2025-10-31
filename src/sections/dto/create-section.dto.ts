import { IsArray, IsInt, IsOptional, IsString, ValidateNested, Allow } from 'class-validator';
import { Type } from 'class-transformer';

export class SectionTranslationInput {
  @IsString()
  locale: string;

  // content is JSON, let it pass-through; validate shape at runtime if needed
  @Allow()
  content: any;
}

export class CreateSectionDto {
  @IsString()
  name: string;

  @IsInt()
  pageId: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionTranslationInput)
  translations?: SectionTranslationInput[];
}


