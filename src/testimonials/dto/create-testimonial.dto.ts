import { IsString, IsNotEmpty, IsUrl, IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTestimonialDto {
  @IsString()
  @IsNotEmpty()
  clientName: string;

  @IsString()
  @IsNotEmpty()
  profession: string;

  @IsString()
  @IsNotEmpty()
  review: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  imageUrl: string;

  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  isActive?: boolean;
}

