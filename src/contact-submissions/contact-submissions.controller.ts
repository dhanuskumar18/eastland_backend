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
  Header,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ContactSubmissionsService } from './contact-submissions.service';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';
import { PaginationDto } from '../testimonials/dto/pagination.dto';
import { SkipCsrf } from '../auth/csrf';
import { JwtGuard, PermissionsGuard } from '../auth/guard';
import { Permissions, GetUser } from '../auth/decorator';
import type { User } from '@prisma/client';

@Controller('contact-submissions')
export class ContactSubmissionsController {
  constructor(
    private readonly contactSubmissionsService: ContactSubmissionsService,
  ) {}

  @SkipCsrf()
  @Post()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async create(@Body() dto: CreateContactSubmissionDto, @Req() req: Request) {
    const userId = (req.user as any)?.id;
    return this.contactSubmissionsService.create(
      dto,
      userId,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }

  @UseGuards(JwtGuard)
  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findAll(@Query() paginationDto?: PaginationDto) {
    return this.contactSubmissionsService.findAll(paginationDto);
  }

  // Specific routes must come BEFORE parameterized routes
  @UseGuards(JwtGuard)
  @Get('unread/count')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  getUnreadCount() {
    return this.contactSubmissionsService.getUnreadCount();
  }

  @UseGuards(JwtGuard)
  @Get('unread/list')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  getUnreadSubmissions(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.contactSubmissionsService.getUnreadSubmissions(limitNum);
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('contact-submission:update')
  @Post('read/all')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  markAllAsRead(
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.contactSubmissionsService.markAllAsRead(
      user.id,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }

  // Parameterized routes come last
  @UseGuards(JwtGuard)
  @Get(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contactSubmissionsService.findOne(id);
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('contact-submission:delete')
  @Delete(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.contactSubmissionsService.remove(
      id,
      user.id,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }

  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions('contact-submission:update')
  @Post(':id/read')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.contactSubmissionsService.markAsRead(
      id,
      user.id,
      req.ip || req.socket.remoteAddress,
      req.get('user-agent')
    );
  }
}

