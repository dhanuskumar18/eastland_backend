import { IsArray, IsOptional, IsString, ValidateNested, Allow } from 'class-validator';
import { Type } from 'class-transformer';

export class GlobalTranslationInput {
  @IsString()
  locale: string;

  @Allow()
  content: any;
}

export class CreateGlobalDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GlobalTranslationInput)
  translations?: GlobalTranslationInput[];
}


