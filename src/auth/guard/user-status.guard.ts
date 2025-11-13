import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class UserStatusGuard implements CanActivate {
  constructor(private prisma: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Skip status check for auth routes (login, signup, etc.)
    if (request.url && request.url.startsWith('/auth/')) {
      return true;
    }

    // If no user, let JwtGuard handle authentication
    if (!user) {
      return true;
    }

    // Fetch latest user status from database
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, status: true },
    });

    if (!currentUser) {
      throw new ForbiddenException({
        success: false,
        message: 'User not found',
        statusCode: 403,
      });
    }

    // Check if user status is INACTIVE
    if (currentUser.status === 'INACTIVE') {
      throw new ForbiddenException({
        success: false,
        message: 'Your account has been deactivated. Please contact administrator.',
        code: 'USER_INACTIVE',
        status: 'INACTIVE',
        statusCode: 403,
      });
    }

    // Update request user with latest status
    request.user = { ...user, status: currentUser.status };

    return true;
  }
}

