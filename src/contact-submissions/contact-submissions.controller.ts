import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ContactSubmissionsService } from './contact-submissions.service';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';
import { PaginationDto } from '../testimonials/dto/pagination.dto';
import { SkipCsrf } from '../auth/csrf';
import { JwtGuard } from '../auth/guard';

@Controller('contact-submissions')
export class ContactSubmissionsController {
  constructor(
    private readonly contactSubmissionsService: ContactSubmissionsService,
  ) {}

  @SkipCsrf()
  @Post()
  async create(@Body() dto: CreateContactSubmissionDto) {
    return this.contactSubmissionsService.create(dto);
  }

  @UseGuards(JwtGuard)
  @Get()
  findAll(@Query() paginationDto?: PaginationDto) {
    return this.contactSubmissionsService.findAll(paginationDto);
  }

  @UseGuards(JwtGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contactSubmissionsService.findOne(id);
  }

  @UseGuards(JwtGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.contactSubmissionsService.remove(id);
  }
}

