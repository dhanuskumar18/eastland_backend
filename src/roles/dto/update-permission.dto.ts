import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class UpdatePermissionDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  resource?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  action?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

