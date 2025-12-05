import { AppAbility } from '../services/ability.factory';
import { User, Role, Permission } from '@prisma/client';

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      name: string | null;
      roleId: number;
      status: string;
      role?: Role & {
        permissions?: Array<{
          permission: Permission;
        }>;
      };
      ability?: AppAbility; // CASL ability object for authorization checks
      sessionId?: string;
    }

    interface Request {
      user?: User;
      ability?: AppAbility; // CASL ability for permission checks
    }
  }
}

export {};

