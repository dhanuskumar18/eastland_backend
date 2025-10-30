import { IsOptional, IsString } from 'class-validator';

export class CreatePageDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string | null;
}


