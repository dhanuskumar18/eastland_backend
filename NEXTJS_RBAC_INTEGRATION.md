# Next.js Frontend RBAC Integration Guide

Complete guide to integrate CASL-based RBAC in your Next.js frontend application.

## Overview

The backend uses CASL for server-side authorization. For the frontend, we'll:
1. Fetch permission strings from the backend API
2. Use them to show/hide UI elements
3. Optionally use CASL on the frontend for advanced checks

## Backend Endpoint

The backend now provides:
- `GET /users/me/permissions` - Returns user permissions as strings

Response format:
```json
{
  "version": "1",
  "code": 200,
  "status": true,
  "message": "OK",
  "data": {
    "permissions": ["user:create", "user:read", "product:update"],
    "role": "ADMIN"
  }
}
```

## Step 1: Install Dependencies

```bash
npm install @casl/react @casl/ability
# or
yarn add @casl/react @casl/ability
```

## Step 2: Create Permission Utilities

Create `lib/permissions.ts`:

```typescript
// lib/permissions.ts
import { Ability, AbilityBuilder, MongoAbility } from '@casl/ability';

export type Actions = 'create' | 'read' | 'update' | 'delete' | 'manage';
export type Subjects = string | 'all';
export type AppAbility = MongoAbility<[Actions, Subjects]>;

/**
 * Create CASL ability from permission strings
 */
export function createAbilityFromPermissions(permissions: string[]): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(Ability);
i
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

  return build();
}

/**
 * Simple permission check (without CASL)
 */
export function hasPermission(
  permissions: string[],
  resource: string,
  action: string
): boolean {
  // Check exact permission
  if (permissions.includes(`${resource}:${action}`)) {
    return true;
  }
  
  // Check wildcard permission
  if (permissions.includes(`${resource}:*`)) {
    return true;
  }
  
  // Check global permission
  if (permissions.includes('*:*')) {
    return true;
  }
  
  return false;
}
```

## Step 3: Create Permission Context

Create `contexts/PermissionContext.tsx`:

```typescript
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Ability } from '@casl/ability';
import { createAbilityFromPermissions } from '@/lib/permissions';

interface PermissionContextType {
  permissions: string[];
  ability: Ability | null;
  loading: boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType>({
  permissions: [],
  ability: null,
  loading: true,
  refreshPermissions: async () => {},
});

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [ability, setAbility] = useState<Ability | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = async () => {
    try {
      const response = await fetch('/api/users/me/permissions', {
        credentials: 'include', // Include cookies for JWT
      });
      
      if (response.ok) {
        const data = await response.json();
        const userPermissions = data.data?.permissions || [];
        
        setPermissions(userPermissions);
        setAbility(createAbilityFromPermissions(userPermissions));
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      setPermissions([]);
      setAbility(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        ability,
        loading,
        refreshPermissions: fetchPermissions,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}
```

## Step 4: Create Permission Hooks

Create `hooks/usePermission.ts`:

```typescript
'use client';

import { usePermissions } from '@/contexts/PermissionContext';
import { hasPermission } from '@/lib/permissions';

/**
 * Hook to check if user has a specific permission
 */
export function usePermission(resource: string, action: string): boolean {
  const { permissions, loading } = usePermissions();
  
  if (loading) return false;
  
  return hasPermission(permissions, resource, action);
}

/**
 * Hook to check multiple permissions (all must be true)
 */
export function usePermissionsAll(
  requiredPermissions: Array<{ resource: string; action: string }>
): boolean {
  const { permissions, loading } = usePermissions();
  
  if (loading) return false;
  
  return requiredPermissions.every(({ resource, action }) =>
    hasPermission(permissions, resource, action)
  );
}

/**
 * Hook to check multiple permissions (any must be true)
 */
export function usePermissionsAny(
  requiredPermissions: Array<{ resource: string; action: string }>
): boolean {
  const { permissions, loading } = usePermissions();
  
  if (loading) return false;
  
  return requiredPermissions.some(({ resource, action }) =>
    hasPermission(permissions, resource, action)
  );
}
```

## Step 5: Create Permission Gate Component

Create `components/PermissionGate.tsx`:

```typescript
'use client';

import { ReactNode } from 'react';
import { usePermission } from '@/hooks/usePermission';

interface PermissionGateProps {
  resource: string;
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component that only renders children if user has permission
 */
export function PermissionGate({
  resource,
  action,
  children,
  fallback = null,
}: PermissionGateProps) {
  const hasAccess = usePermission(resource, action);
  
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
```

## Step 6: Create Next.js API Route

Create `app/api/users/me/permissions/route.ts` (App Router) or `pages/api/users/me/permissions.ts` (Pages Router):

```typescript
// app/api/users/me/permissions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Get JWT token from cookies or Authorization header
    const cookieStore = cookies();
    const token = cookieStore.get('access_token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Call your NestJS backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/users/me/permissions`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch permissions' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Permission fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Step 7: Wrap Your App

```typescript
// app/layout.tsx
import { PermissionProvider } from '@/contexts/PermissionContext';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PermissionProvider>
          {children}
        </PermissionProvider>
      </body>
    </html>
  );
}
```

## Usage Examples

### Example 1: Using PermissionGate Component

```typescript
'use client';

import { PermissionGate } from '@/components/PermissionGate';
import { Button } from '@/components/ui/button';

export function UserManagement() {
  return (
    <div>
      <h1>User Management</h1>
      
      {/* Only show create button if user has permission */}
      <PermissionGate resource="user" action="create">
        <Button>Create User</Button>
      </PermissionGate>
      
      {/* Show different content if no permission */}
      <PermissionGate 
        resource="user" 
        action="create"
        fallback={<p>You don't have permission to create users</p>}
      >
        <Button>Create User</Button>
      </PermissionGate>
    </div>
  );
}
```

### Example 2: Using usePermission Hook

```typescript
'use client';

import { usePermission } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';

export function UserActions() {
  const canCreate = usePermission('user', 'create');
  const canUpdate = usePermission('user', 'update');
  const canDelete = usePermission('user', 'delete');

  return (
    <div>
      {canCreate && (
        <Button onClick={() => console.log('Create user')}>
          Create User
        </Button>
      )}
      
      {canUpdate && (
        <Button onClick={() => console.log('Update user')}>
          Update User
        </Button>
      )}
      
      {canDelete && (
        <Button variant="destructive" onClick={() => console.log('Delete user')}>
          Delete User
        </Button>
      )}
    </div>
  );
}
```

### Example 3: Using CASL Can Component (Advanced)

```typescript
'use client';

import { usePermissions } from '@/contexts/PermissionContext';
import { Can } from '@casl/react';

export function AdvancedUserManagement() {
  const { ability } = usePermissions();

  if (!ability) return <div>Loading...</div>;

  return (
    <div>
      <Can I="create" a="user" ability={ability}>
        <Button>Create User</Button>
      </Can>
      
      <Can I="read" a="user" ability={ability}>
        <UserList />
      </Can>
      
      <Can I="update" a="user" ability={ability}>
        <Button>Edit User</Button>
      </Can>
    </div>
  );
}
```

### Example 4: Server Component (Next.js App Router)

```typescript
// app/users/page.tsx
import { cookies } from 'next/headers';
import { hasPermission } from '@/lib/permissions';

async function getUserPermissions() {
  const cookieStore = cookies();
  const token = cookieStore.get('access_token')?.value;

  if (!token) return [];

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const response = await fetch(`${backendUrl}/users/me/permissions`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store', // Always fetch fresh permissions
  });

  if (!response.ok) return [];

  const data = await response.json();
  return data.data?.permissions || [];
}

export default async function UsersPage() {
  const permissions = await getUserPermissions();
  const canCreate = hasPermission(permissions, 'user', 'create');
  const canRead = hasPermission(permissions, 'user', 'read');

  return (
    <div>
      <h1>Users</h1>
      {canCreate && (
        <a href="/users/create" className="btn">
          Create New User
        </a>
      )}
      {canRead && (
        <div>
          {/* User list */}
        </div>
      )}
    </div>
  );
}
```

### Example 5: Middleware for Route Protection

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;

  // Protect admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Verify token and check permissions
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${backendUrl}/users/me/permissions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const permissions = data.data?.permissions || [];
        
        // Check if user has admin permissions
        const isAdmin = permissions.includes('*:*') || 
                       permissions.some(p => p.startsWith('admin:'));
        
        if (!isAdmin) {
          return NextResponse.redirect(new URL('/unauthorized', request.url));
        }
      } else {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    } catch (error) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
```

## Best Practices

1. **Server-Side Validation**: Always validate permissions on the backend. Frontend checks are for UX only.

2. **Cache Permissions**: Permissions are cached in context to avoid repeated API calls.

3. **Refresh on Login**: Call `refreshPermissions()` after user logs in.

4. **Error Handling**: Handle cases where permission fetch fails gracefully.

5. **Loading States**: Show loading states while fetching permissions.

6. **Type Safety**: Use TypeScript for permission strings to avoid typos.

## Type Safety (Optional)

Create `types/permissions.ts`:

```typescript
export type Resource = 'user' | 'product' | 'role' | 'permission';
export type Action = 'create' | 'read' | 'update' | 'delete' | 'manage';

export type Permission = `${Resource}:${Action}` | `${Resource}:*` | '*:*';

// Type-safe permission check
export function checkPermission(
  permissions: string[],
  resource: Resource,
  action: Action
): boolean {
  return permissions.includes(`${resource}:${action}`) ||
         permissions.includes(`${resource}:*`) ||
         permissions.includes('*:*');
}
```

## Environment Variables

Add to your `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Summary

1. ✅ Backend endpoint `/users/me/permissions` is ready
2. ✅ Install `@casl/react` and `@casl/ability`
3. ✅ Create permission utilities and hooks
4. ✅ Create PermissionContext and PermissionGate component
5. ✅ Create Next.js API route to proxy backend calls
6. ✅ Use in your components to show/hide UI elements
7. ✅ Always validate on backend - frontend is for UX only

This setup gives you a complete RBAC system in Next.js that works seamlessly with your NestJS backend!

