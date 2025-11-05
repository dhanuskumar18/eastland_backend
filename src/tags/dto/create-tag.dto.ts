import { IsEnum, IsString } from 'class-validator';

export enum TagForDto {
  VIDEO = 'video',
  PRODUCT = 'product',
}

export class CreateTagDto {
  @IsString()
  name: string;

  @IsEnum(TagForDto)
  for: TagForDto;
}

