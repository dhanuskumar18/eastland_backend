import { IsString, IsOptional, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  resource: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  action: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

