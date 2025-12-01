import { IsOptional, IsString } from 'class-validator';

export class TestimonialFilterDto {
  @IsOptional()
  @IsString()
  search?: string;
}

