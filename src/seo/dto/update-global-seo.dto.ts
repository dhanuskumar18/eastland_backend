import { PartialType } from '@nestjs/mapped-types';
import { CreateGlobalSeoDto } from './create-global-seo.dto';

export class UpdateGlobalSeoDto extends PartialType(CreateGlobalSeoDto) {}

