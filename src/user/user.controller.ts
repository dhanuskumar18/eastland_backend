import { Controller, Get, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { JwtGuard } from 'src/auth/guard';
import { GetUser } from 'src/auth/decorator';
@Controller('users')
export class UserController {
    @UseGuards(JwtGuard)    
    @Get('me')
    getMe(@GetUser() user: User) {
        return user;
    }
}
