import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsUrl } from 'class-validator';
import { CreateTestimonialDto } from './create-testimonial.dto';

export class UpdateTestimonialDto extends PartialType(CreateTestimonialDto) {
  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}

