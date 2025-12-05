import { Injectable } from '@nestjs/common';
import { Ability, AbilityBuilder, AbilityClass, ExtractSubjectType, InferSubjects, MongoAbility } from '@casl/ability';
import { RolesService } from '../../roles/roles.service';

// Define subject types for CASL
export type Subjects = string | 'all';
export type Actions = 'create' | 'read' | 'update' | 'delete' | 'manage';

export type AppAbility = MongoAbility<[Actions, Subjects]>;

@Injectable()
export class AbilityFactory {
  constructor(private rolesService: RolesService) {}

  /**
   * Create CASL ability for a user based on their permissions
   * Permissions are loaded from database and converted to CASL rules
   */
  async createForUser(userId: number): Promise<AppAbility> {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      Ability as AbilityClass<AppAbility>,
    );

    // Load user permissions from database
    const permissions = await this.rolesService.getUserPermissionsWithDetails(userId);

    // Convert database permissions to CASL rules
    for (const permission of permissions) {
      const action = permission.action.toLowerCase() as Actions;
      const resource = permission.resource.toLowerCase();

      // Handle wildcard actions (e.g., 'manage' or '*')
      if (permission.action === '*' || permission.action === 'manage') {
        can('manage', resource);
      } else {
        can(action, resource);
      }

      // Handle wildcard resources (e.g., '*')
      if (permission.resource === '*') {
        can(action, 'all');
      }
    }

    return build({
      detectSubjectType: (item) => item as ExtractSubjectType<Subjects>,
    });
  }

  /**
   * Create ability from permission strings (for testing or direct use)
   * Format: 'resource:action' or 'resource:*' or '*:*'
   */
  createFromPermissions(permissions: string[]): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(
      Ability as AbilityClass<AppAbility>,
    );

    for (const perm of permissions) {
      const [resource, action] = perm.split(':');
      
      if (resource === '*' && action === '*') {
        can('manage', 'all');
      } else if (action === '*') {
        can('manage', resource.toLowerCase());
      } else {
        can(action.toLowerCase() as Actions, resource.toLowerCase());
      }
    }

    return build({
      detectSubjectType: (item) => item as ExtractSubjectType<Subjects>,
    });
  }
}

