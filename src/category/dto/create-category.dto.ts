import { IsEnum, IsString } from 'class-validator';

export enum CategoryForDto {
  VIDEO = 'video',
  PRODUCT = 'product',
}

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsEnum(CategoryForDto)
  for: CategoryForDto;
}


