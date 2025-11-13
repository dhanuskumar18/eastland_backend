import { IsString, IsNotEmpty, IsUrl } from 'class-validator';

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
}

