import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreatePageSeoDto } from './create-page-seo.dto';

export class UpdatePageSeoDto extends PartialType(
  OmitType(CreatePageSeoDto, ['pageId'] as const),
) {}

