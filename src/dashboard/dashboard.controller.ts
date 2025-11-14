import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtGuard } from '../auth/guard';
import { SkipCsrf } from '../auth/csrf';

@SkipCsrf()
@Controller('dashboard')
@UseGuards(JwtGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard() {
    const data = await this.dashboardService.getDashboardStats();

    return {
      version: '1',
      code: 200,
      status: true,
      message: 'Dashboard data retrieved successfully',
      validationErrors: [],
      data,
    };
  }
}

