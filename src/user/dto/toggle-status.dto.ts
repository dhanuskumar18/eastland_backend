import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class ToggleStatusDto {
  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(UserStatus, {
    message: 'Status must be either ACTIVE or INACTIVE',
  })
  status: UserStatus;
}


