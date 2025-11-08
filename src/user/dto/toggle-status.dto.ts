import { IsEnum } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class ToggleStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}


