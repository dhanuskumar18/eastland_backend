import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

/**
 * UserStatusGuard - Real-time User Status Validation
 * 
 * ACCESS CONTROL CHECKLIST ITEM #1:
 * - Implements strict server-side access control logic
 * - Validates user status on every request (real-time enforcement)
 * 
 * How it works:
 * 1. Fetches latest user status from database on every request
 * 2. Blocks access if user status is INACTIVE (even if JWT token is valid)
 * 3. Provides real-time status enforcement (admin can deactivate user immediately)
 * 
 * Security features:
 * - Server-side validation: Status checked from database, not from token
 * - Real-time enforcement: Status changes take effect immediately
 * - Fail-secure: Inactive users are denied access even with valid tokens
 * 
 * Usage:
 * @UseGuards(JwtGuard, UserStatusGuard)
 */
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

    // Security: Fetch latest user status from database on every request
    // This ensures real-time enforcement - if admin deactivates user,
    // subsequent requests are immediately blocked
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

    // Access control: Block inactive users from accessing any resources
    // This is server-side enforcement - client cannot bypass this check
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

