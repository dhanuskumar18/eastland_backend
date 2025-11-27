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

  // Specific routes must come BEFORE parameterized routes
  @UseGuards(JwtGuard)
  @Get('unread/count')
  getUnreadCount() {
    return this.contactSubmissionsService.getUnreadCount();
  }

  @UseGuards(JwtGuard)
  @Get('unread/list')
  getUnreadSubmissions(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.contactSubmissionsService.getUnreadSubmissions(limitNum);
  }

  @UseGuards(JwtGuard)
  @Post('read/all')
  markAllAsRead() {
    return this.contactSubmissionsService.markAllAsRead();
  }

  // Parameterized routes come last
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

  @UseGuards(JwtGuard)
  @Post(':id/read')
  markAsRead(@Param('id', ParseIntPipe) id: number) {
    return this.contactSubmissionsService.markAsRead(id);
  }
}

