import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsUrl, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTestimonialDto } from './create-testimonial.dto';

export class UpdateTestimonialDto extends PartialType(CreateTestimonialDto) {
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  isActive?: boolean;
}

