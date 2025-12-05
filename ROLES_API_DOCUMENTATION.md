# Roles API Documentation

This document provides sample request payloads and responses for all endpoints in the Roles Controller.

**Base URL:** `/roles`

**Authentication:** All endpoints require JWT authentication and ADMIN role.

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

---

## Permission Endpoints

### 1. Create Permission

**Endpoint:** `POST /roles/permissions`

**Request Payload:**
```json
{
  "name": "manage_users",
  "resource": "user",
  "action": "manage",
  "description": "Full access to manage users"
}
```

**Response (201 Created):**
```json
{
  "version": "1",
  "code": 201,
  "status": true,
  "message": "Permission created successfully",
  "data": {
    "id": 1,
    "name": "manage_users",
    "resource": "user",
    "action": "manage",
    "description": "Full access to manage users",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "_count": {
      "roles": 0
    }
  }
}
```

**Validation Rules:**
- `name`: Required, string, 2-50 characters
- `resource`: Required, string, 2-50 characters
- `action`: Required, string, 2-50 characters
- `description`: Optional, string, max 500 characters

**Important Note on Multiple Resources/Actions:**

Since `resource` and `action` are single string fields, you have three approaches to handle multiple resources/actions.

> 💡 **Why Strings Instead of Arrays?** The current string-based design is **20-50x faster** than array-based approaches for queries and integrates perfectly with CASL. See `PERMISSION_SCHEMA_ANALYSIS.md` for a detailed comparison of different schema approaches.

#### Approach 1: Create Separate Permissions (Recommended for Granular Control)

Create one permission record for each resource-action combination. **Use the batch endpoint for efficiency:**

```bash
# ✅ Recommended: Create all permissions in one API call
POST /roles/permissions/batch
{
  "permissions": [
    {
      "name": "create_users",
      "resource": "user",
      "action": "create",
      "description": "Create new users"
    },
    {
      "name": "read_users",
      "resource": "user",
      "action": "read",
      "description": "Read user information"
    },
    {
      "name": "create_products",
      "resource": "product",
      "action": "create",
      "description": "Create new products"
    },
    {
      "name": "read_products",
      "resource": "product",
      "action": "read",
      "description": "Read product information"
    }
  ]
}
# Response includes all created permission IDs: [1, 2, 3, 4]

# Then assign all these permission IDs to a role:
POST /roles/1/permissions
{
  "permissionIds": [1, 2, 3, 4]  // All permission IDs from batch response
}
```

**Alternative: Individual API calls (less efficient):**
```bash
# ❌ Less efficient: Multiple separate API calls
POST /roles/permissions { "name": "create_users", "resource": "user", "action": "create" }
POST /roles/permissions { "name": "read_users", "resource": "user", "action": "read" }
POST /roles/permissions { "name": "create_products", "resource": "product", "action": "create" }
POST /roles/permissions { "name": "read_products", "resource": "product", "action": "read" }
```

#### Approach 2: Use Wildcards (Recommended for Broad Permissions)

Use `*` to represent "all" resources or "all" actions:

```bash
# All actions on user resource (user:create, user:read, user:update, user:delete, etc.)
POST /roles/permissions
{
  "name": "all_user_actions",
  "resource": "user",
  "action": "*",
  "description": "All actions on user resource"
}

# Read action on all resources (user:read, product:read, role:read, etc.)
POST /roles/permissions
{
  "name": "read_all_resources",
  "resource": "*",
  "action": "read",
  "description": "Read access to all resources"
}

# All actions on all resources (super admin permission)
POST /roles/permissions
{
  "name": "super_admin",
  "resource": "*",
  "action": "*",
  "description": "Full access to all resources and actions"
}
```

#### Approach 3: Use "manage" Action (Special Wildcard)

The system recognizes `"manage"` as a special action that grants all permissions for a resource:

```bash
# Grants all actions (create, read, update, delete) on user resource
POST /roles/permissions
{
  "name": "manage_users",
  "resource": "user",
  "action": "manage",
  "description": "Full management access to users"
}

# This is equivalent to user:create, user:read, user:update, user:delete
```

**Comparison:**

| Approach | Use Case | Pros | Cons |
|----------|----------|------|------|
| **Separate Permissions** | Fine-grained control, audit specific actions | Precise control, easy to audit | More records to manage |
| **Wildcards** | Broad permissions, role-based access | Fewer records, flexible | Less granular control |
| **"manage" Action** | Full control over a resource | Simple, clear intent | All-or-nothing per resource |

**Example: Creating Permissions for Multiple Resources**

If you need a role that can:
- Create and read users
- Create, read, and update products
- Read roles

You can create permissions like this:

```bash
# Option A: Granular (6 permissions)
POST /roles/permissions
{ "name": "create_users", "resource": "user", "action": "create" }
{ "name": "read_users", "resource": "user", "action": "read" }
{ "name": "create_products", "resource": "product", "action": "create" }
{ "name": "read_products", "resource": "product", "action": "read" }
{ "name": "update_products", "resource": "product", "action": "update" }
{ "name": "read_roles", "resource": "role", "action": "read" }

# Option B: Using wildcards (3 permissions)
POST /roles/permissions
{ "name": "user_crud", "resource": "user", "action": "*" }  // All user actions
{ "name": "product_crud", "resource": "product", "action": "*" }  // All product actions
{ "name": "read_roles", "resource": "role", "action": "read" }

# Option C: Mixed approach (3 permissions)
POST /roles/permissions
{ "name": "manage_users", "resource": "user", "action": "manage" }  // All user actions
{ "name": "product_crud", "resource": "product", "action": "*" }  // All product actions
{ "name": "read_roles", "resource": "role", "action": "read" }
```

---

### 2. Create Multiple Permissions (Batch)

**Endpoint:** `POST /roles/permissions/batch`

**Request Since `resource` and `action` are single string fields, you have three approaches to handle multiple resources/actions.Payload:**
```json
{
  "permissions": [
    {
      "name": "create_users",
      "resource": "user",
      "action": "create",
      "description": "Create new users"
    },
    {
      "name": "read_users",
      "resource": "user",
      "action": "read",
      "description": "Read user information"
    },
    {
      "name": "update_users",
      "resource": "user",
      "action": "update",
      "description": "Update user information"
    },
    {
      "name": "delete_users",
      "resource": "user",
      "action": "delete",
      "description": "Delete users"
    },
    {
      "name": "read_products",
      "resource": "product",
      "action": "read",
      "description": "Read product information"
    }
  ]
}
```

**Response (201 Created) - All Successful:**
```json
{
  "version": "1",
  "code": 201,
  "status": true,
  "message": "Successfully created 5 of 5 permissions",
  "data": {
    "success": [
      {
        "id": 1,
        "name": "create_users",
        "resource": "user",
        "action": "create",
        "description": "Create new users",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z",
        "_count": {
          "roles": 0
        }
      },
      {
        "id": 2,
        "name": "read_users",
        "resource": "user",
        "action": "read",
        "description": "Read user information",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z",
        "_count": {
          "roles": 0
        }
      }
      // ... more permissions
    ],
    "failed": [],
    "total": 5,
    "created": 5
  }
}
```

**Response (201 Created) - Partial Success:**
```json
{
  "version": "1",
  "code": 201,
  "status": true,
  "message": "Successfully created 3 of 5 permissions",
  "data": {
    "success": [
      {
        "id": 1,
        "name": "create_users",
        "resource": "user",
        "action": "create",
        "description": "Create new users",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z",
        "_count": {
          "roles": 0
        }
      }
      // ... successfully created permissions
    ],
    "failed": [
      {
        "permission": {
          "name": "read_users",
          "resource": "user",
          "action": "read",
          "description": "Read user information"
        },
        "error": "Permission name already exists or resource-action combination already exists"
      },
      {
        "permission": {
          "name": "update_users",
          "resource": "user",
          "action": "update",
          "description": "Update user information"
        },
        "error": "Permission name already exists or resource-action combination already exists"
      }
    ],
    "total": 5,
    "created": 3,
    "failedCount": 2
  }
}
```

**Validation Rules:**
- `permissions`: Required, array, minimum 1 item
- Each permission object follows the same rules as single permission creation:
  - `name`: Required, string, 2-50 characters
  - `resource`: Required, string, 2-50 characters
  - `action`: Required, string, 2-50 characters
  - `description`: Optional, string, max 500 characters

**Benefits of Batch Creation:**
- ✅ **Single API call** instead of multiple requests
- ✅ **Transaction-based** - attempts to create all in one transaction for better performance
- ✅ **Partial success handling** - if some fail, others still succeed
- ✅ **Detailed error reporting** - shows which permissions failed and why
- ✅ **Reduced network overhead** - one request instead of N requests
- ✅ **Better performance** - database transaction is more efficient than multiple individual creates

**Error Response (400 Bad Request) - All Failed:**
```json
{
  "statusCode": 400,
  "message": "Failed to create any permissions: Permission name already exists or resource-action combination already exists, Permission name already exists or resource-action combination already exists",
  "error": "Bad Request"
}
```

**Example: Creating Permissions for Multiple Resources**

Instead of making 5 separate API calls:
```bash
# ❌ Inefficient: 5 separate API calls
POST /roles/permissions { "name": "create_users", "resource": "user", "action": "create" }
POST /roles/permissions { "name": "read_users", "resource": "user", "action": "read" }
POST /roles/permissions { "name": "update_users", "resource": "user", "action": "update" }
POST /roles/permissions { "name": "delete_users", "resource": "user", "action": "delete" }
POST /roles/permissions { "name": "read_products", "resource": "product", "action": "read" }
```

Use a single batch call:
```bash
# ✅ Efficient: 1 API call
POST /roles/permissions/batch
{
  "permissions": [
    { "name": "create_users", "resource": "user", "action": "create" },
    { "name": "read_users", "resource": "user", "action": "read" },
    { "name": "update_users", "resource": "user", "action": "update" },
    { "name": "delete_users", "resource": "user", "action": "delete" },
    { "name": "read_products", "resource": "product", "action": "read" }
  ]
}
```

---

### 3. Get All Permissions (with pagination)

**Endpoint:** `GET /roles/permissions/all?page=1&limit=10`

**Query Parameters:**
- `page` (optional): Page number (default: 1, min: 1)
- `limit` (optional): Items per page (default: 10, min: 1, max: 100)

**Request Example:**
```
GET /roles/permissions/all?page=1&limit=10
```

**Response (200 OK) - With Pagination:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "manage_users",
      "resource": "user",
      "action": "manage",
      "description": "Full access to manage users",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "_count": {
        "roles": 2
      }
    },
    {
      "id": 2,
      "name": "read_products",
      "resource": "product",
      "action": "read",
      "description": "Read product information",
      "createdAt": "2024-01-15T10:35:00.000Z",
      "updatedAt": "2024-01-15T10:35:00.000Z",
      "_count": {
        "roles": 1
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

**Request Example (without pagination):**
```
GET /roles/permissions/all
```

**Response (200 OK) - Without Pagination:**
```json
[
  {
    "id": 1,
    "name": "manage_users",
    "resource": "user",
    "action": "manage",
    "description": "Full access to manage users",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "_count": {
      "roles": 2
    }
  },
  {
    "id": 2,
    "name": "read_products",
    "resource": "product",
    "action": "read",
    "description": "Read product information",
    "createdAt": "2024-01-15T10:35:00.000Z",
    "updatedAt": "2024-01-15T10:35:00.000Z",
    "_count": {
      "roles": 1
    }
  }
]
```

---

### 4. Get Permission by ID

**Endpoint:** `GET /roles/permissions/:id`

**Request Example:**
```
GET /roles/permissions/1
```

**Response (200 OK):**
```json
{
  "version": "1",
  "code": 200,
  "status": true,
  "message": "OK",
  "data": {
    "id": 1,
    "name": "manage_users",
    "resource": "user",
    "action": "manage",
    "description": "Full access to manage users",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "roles": [
      {
        "id": 1,
        "roleId": 1,
        "permissionId": 1,
        "createdAt": "2024-01-15T11:00:00.000Z",
        "role": {
          "id": 1,
          "name": "admin",
          "description": "Administrator role",
          "createdAt": "2024-01-15T09:00:00.000Z",
          "updatedAt": "2024-01-15T09:00:00.000Z"
        }
      }
    ],
    "_count": {
      "roles": 1
    }
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Permission not found",
  "error": "Not Found"
}
```

---

### 5. Update Permission

**Endpoint:** `PATCH /roles/permissions/:id`

**Request Payload:**
```json
{
  "name": "manage_all_users",
  "description": "Updated description for managing all users"
}
```

**Partial Update Example:**
```json
{
  "description": "Updated description only"
}
```

**Response (200 OK):**
```json
{
  "version": "1",
  "code": 200,
  "status": true,
  "message": "Permission updated successfully",
  "data": {
    "id": 1,
    "name": "manage_all_users",
    "resource": "user",
    "action": "manage",
    "description": "Updated description for managing all users",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T12:00:00.000Z",
    "_count": {
      "roles": 2
    }
  }
}
```

**Validation Rules:**
- All fields are optional
- `name`: String, 2-50 characters (if provided)
- `resource`: String, 2-50 characters (if provided)
- `action`: String, 2-50 characters (if provided)
- `description`: String, max 500 characters (if provided)

**Error Response (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Permission name already exists or resource-action combination already exists",
  "error": "Bad Request"
}
```

---

### 6. Delete Permission

**Endpoint:** `DELETE /roles/permissions/:id`

**Request Example:**
```
DELETE /roles/permissions/1
```

**Response (200 OK):**
```json
{
  "version": "1",
  "code": 200,
  "status": true,
  "message": "Permission deleted successfully"
}
```

**Error Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Permission not found",
  "error": "Not Found"
}
```

---

## Role Endpoints

### 7. Create Role

**Endpoint:** `POST /roles`

**Request Payload:**
```json
{
  "name": "editor",
  "description": "Editor role with content management permissions"
}
```

**Response (201 Created):**
```json
{
  "version": "1",
  "code": 201,
  "status": true,
  "message": "Role created successfully",
  "data": {
    "id": 2,
    "name": "editor",
    "description": "Editor role with content management permissions",
    "createdAt": "2024-01-15T11:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z",
    "permissions": []
  }
}
```

**Validation Rules:**
- `name`: Required, string, 2-50 characters, must be unique
- `description`: Optional, string, max 500 characters

**Error Response (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Role name already exists",
  "error": "Bad Request"
}
```

---

### 8. Get All Roles (with pagination)

**Endpoint:** `GET /roles?page=1&limit=10`

**Query Parameters:**
- `page` (optional): Page number (default: 1, min: 1)
- `limit` (optional): Items per page (default: 10, min: 1, max: 100)

**Request Example:**
```
GET /roles?page=1&limit=10
```

**Response (200 OK) - With Pagination:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "admin",
      "description": "Administrator role with full access",
      "createdAt": "2024-01-15T09:00:00.000Z",
      "updatedAt": "2024-01-15T09:00:00.000Z",
      "permissions": [
        {
          "id": 1,
          "roleId": 1,
          "permissionId": 1,
          "createdAt": "2024-01-15T11:00:00.000Z",
          "permission": {
            "id": 1,
            "name": "manage_users",
            "resource": "user",
            "action": "manage",
            "description": "Full access to manage users",
            "createdAt": "2024-01-15T10:30:00.000Z",
            "updatedAt": "2024-01-15T10:30:00.000Z"
          }
        }
      ],
      "_count": {
        "users": 5
      }
    },
    {
      "id": 2,
      "name": "editor",
      "description": "Editor role with content management permissions",
      "createdAt": "2024-01-15T11:00:00.000Z",
      "updatedAt": "2024-01-15T11:00:00.000Z",
      "permissions": [],
      "_count": {
        "users": 2
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 3,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

**Request Example (without pagination):**
```
GET /roles
```

**Response (200 OK) - Without Pagination:**
```json
[
  {
    "id": 1,
    "name": "admin",
    "description": "Administrator role with full access",
    "createdAt": "2024-01-15T09:00:00.000Z",
    "updatedAt": "2024-01-15T09:00:00.000Z",
    "permissions": [
      {
        "id": 1,
        "roleId": 1,
        "permissionId": 1,
        "createdAt": "2024-01-15T11:00:00.000Z",
        "permission": {
          "id": 1,
          "name": "manage_users",
          "resource": "user",
          "action": "manage",
          "description": "Full access to manage users",
          "createdAt": "2024-01-15T10:30:00.000Z",
          "updatedAt": "2024-01-15T10:30:00.000Z"
        }
      }
    ],
    "_count": {
      "users": 5
    }
  }
]
```

---

### 9. Get Role by ID

**Endpoint:** `GET /roles/:id`

**Request Example:**
```
GET /roles/1
```

**Response (200 OK):**
```json
{
  "version": "1",
  "code": 200,
  "status": true,
  "message": "OK",
  "data": {
    "id": 1,
    "name": "admin",
    "description": "Administrator role with full access",
    "createdAt": "2024-01-15T09:00:00.000Z",
    "updatedAt": "2024-01-15T09:00:00.000Z",
    "permissions": [
      {
        "id": 1,
        "roleId": 1,
        "permissionId": 1,
        "createdAt": "2024-01-15T11:00:00.000Z",
        "permission": {
          "id": 1,
          "name": "manage_users",
          "resource": "user",
          "action": "manage",
          "description": "Full access to manage users",
          "createdAt": "2024-01-15T10:30:00.000Z",
          "updatedAt": "2024-01-15T10:30:00.000Z"
        }
      },
      {
        "id": 2,
        "roleId": 1,
        "permissionId": 2,
        "createdAt": "2024-01-15T11:05:00.000Z",
        "permission": {
          "id": 2,
          "name": "read_products",
          "resource": "product",
          "action": "read",
          "description": "Read product information",
          "createdAt": "2024-01-15T10:35:00.000Z",
          "updatedAt": "2024-01-15T10:35:00.000Z"
        }
      }
    ],
    "_count": {
      "users": 5
    }
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Role not found",
  "error": "Not Found"
}
```

---

### 10. Update Role

**Endpoint:** `PATCH /roles/:id`

**Request Payload:**
```json
{
  "name": "super_admin",
  "description": "Super administrator with extended privileges"
}
```

**Partial Update Example:**
```json
{
  "description": "Updated description only"
}
```

**Response (200 OK):**
```json
{
  "version": "1",
  "code": 200,
  "status": true,
  "message": "Role updated successfully",
  "data": {
    "id": 1,
    "name": "super_admin",
    "description": "Super administrator with extended privileges",
    "createdAt": "2024-01-15T09:00:00.000Z",
    "updatedAt": "2024-01-15T12:00:00.000Z",
    "permissions": [
      {
        "id": 1,
        "roleId": 1,
        "permissionId": 1,
        "createdAt": "2024-01-15T11:00:00.000Z",
        "permission": {
          "id": 1,
          "name": "manage_users",
          "resource": "user",
          "action": "manage",
          "description": "Full access to manage users",
          "createdAt": "2024-01-15T10:30:00.000Z",
          "updatedAt": "2024-01-15T10:30:00.000Z"
        }
      }
    ],
    "_count": {
      "users": 5
    }
  }
}
```

**Validation Rules:**
- All fields are optional
- `name`: String, 2-50 characters, must be unique (if provided)
- `description`: String, max 500 characters (if provided)

**Error Response (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Role name already exists",
  "error": "Bad Request"
}
```

---

### 11. Delete Role

**Endpoint:** `DELETE /roles/:id`

**Request Example:**
```
DELETE /roles/2
```

**Response (200 OK):**
```json
{
  "version": "1",
  "code": 200,
  "status": true,
  "message": "Role deleted successfully"
}
```

**Error Response (400 Bad Request) - Role has assigned users:**
```json
{
  "statusCode": 400,
  "message": "Cannot delete role. It is assigned to 3 user(s). Please reassign users first.",
  "error": "Bad Request"
}
```

**Error Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Role not found",
  "error": "Not Found"
}
```

---

### 12. Assign Permissions to Role

**Endpoint:** `POST /roles/:id/permissions`

**Request Payload:**
```json
{
  "permissionIds": [1, 2, 3, 5]
}
```

**Response (200 OK):**
```json
{
  "version": "1",
  "code": 200,
  "status": true,
  "message": "Permissions assigned successfully",
  "data": {
    "id": 2,
    "name": "editor",
    "description": "Editor role with content management permissions",
    "createdAt": "2024-01-15T11:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z",
    "permissions": [
      {
        "id": 1,
        "roleId": 2,
        "permissionId": 1,
        "createdAt": "2024-01-15T12:00:00.000Z",
        "permission": {
          "id": 1,
          "name": "manage_users",
          "resource": "user",
          "action": "manage",
          "description": "Full access to manage users",
          "createdAt": "2024-01-15T10:30:00.000Z",
          "updatedAt": "2024-01-15T10:30:00.000Z"
        }
      },
      {
        "id": 2,
        "roleId": 2,
        "permissionId": 2,
        "createdAt": "2024-01-15T12:00:00.000Z",
        "permission": {
          "id": 2,
          "name": "read_products",
          "resource": "product",
          "action": "read",
          "description": "Read product information",
          "createdAt": "2024-01-15T10:35:00.000Z",
          "updatedAt": "2024-01-15T10:35:00.000Z"
        }
      },
      {
        "id": 3,
        "roleId": 2,
        "permissionId": 3,
        "createdAt": "2024-01-15T12:00:00.000Z",
        "permission": {
          "id": 3,
          "name": "create_products",
          "resource": "product",
          "action": "create",
          "description": "Create new products",
          "createdAt": "2024-01-15T10:40:00.000Z",
          "updatedAt": "2024-01-15T10:40:00.000Z"
        }
      },
      {
        "id": 4,
        "roleId": 2,
        "permissionId": 5,
        "createdAt": "2024-01-15T12:00:00.000Z",
        "permission": {
          "id": 5,
          "name": "update_products",
          "resource": "product",
          "action": "update",
          "description": "Update existing products",
          "createdAt": "2024-01-15T10:45:00.000Z",
          "updatedAt": "2024-01-15T10:45:00.000Z"
        }
      }
    ],
    "_count": {
      "users": 2
    }
  }
}
```

**Validation Rules:**
- `permissionIds`: Required, array of integers, minimum 0 items

**Error Response (400 Bad Request) - Invalid permission IDs:**
```json
{
  "statusCode": 400,
  "message": "Permissions not found: 10, 15",
  "error": "Bad Request"
}
```

**Error Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Role not found",
  "error": "Not Found"
}
```

**Note:** This endpoint replaces all existing permissions with the provided list. Permissions not in the list will be removed, and new permissions will be added.

---

## Common Error Responses

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 403 Forbidden (Insufficient permissions)
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

### 400 Bad Request (Validation Error)
```json
{
  "statusCode": 400,
  "message": [
    "name must be longer than or equal to 2 characters",
    "name should not be empty"
  ],
  "error": "Bad Request"
}
```

---

## Complete Workflow Example: Setting Up a Role with Multiple Permissions

Here's a step-by-step example of creating a "Content Manager" role that can:
- Manage all user operations (create, read, update, delete)
- Read and update products (but not create or delete)
- Read roles and permissions

### Step 1: Create Permissions (Using Batch Endpoint - Recommended)

```bash
# ✅ Efficient: Create all permissions in one API call
POST /roles/permissions/batch
{
  "permissions": [
    {
      "name": "manage_users",
      "resource": "user",
      "action": "manage",
      "description": "Full access to manage users"
    },
    {
      "name": "read_products",
      "resource": "product",
      "action": "read",
      "description": "Read product information"
    },
    {
      "name": "update_products",
      "resource": "product",
      "action": "update",
      "description": "Update existing products"
    },
    {
      "name": "read_roles",
      "resource": "role",
      "action": "read",
      "description": "Read role information"
    },
    {
      "name": "read_permissions",
      "resource": "permission",
      "action": "read",
      "description": "Read permission information"
    }
  ]
}
# Response: { "data": { "success": [...], "total": 5, "created": 5 } }
# Permission IDs: [1, 2, 3, 4, 5]
```

**Alternative: Individual Permissions (Less Efficient)**

If you prefer individual calls (not recommended for multiple permissions):
```bash
# ❌ Less efficient: 5 separate API calls
POST /roles/permissions
{
  "name": "manage_users",
  "resource": "user",
  "action": "manage",
  "description": "Full access to manage users"
}
# Response: { "data": { "id": 1, ... } }

POST /roles/permissions
{
  "name": "read_products",
  "resource": "product",
  "action": "read",
  "description": "Read product information"
}
# Response: { "data": { "id": 2, ... } }

# ... continue for each permission
```

### Step 2: Create the Role

```bash
POST /roles
{
  "name": "content_manager",
  "description": "Content manager role with user and product management permissions"
}
# Response: { "data": { "id": 1, ... } }
```

### Step 3: Assign Permissions to Role

```bash
POST /roles/1/permissions
{
  "permissionIds": [1, 2, 3, 4, 5]
}
# Response: { "data": { "id": 1, "permissions": [...], ... } }
```

### Step 4: Verify the Setup

```bash
# Get the role with all permissions
GET /roles/1

# Response will show:
{
  "data": {
    "id": 1,
    "name": "content_manager",
    "permissions": [
      { "permission": { "resource": "user", "action": "manage" } },
      { "permission": { "resource": "product", "action": "read" } },
      { "permission": { "resource": "product", "action": "update" } },
      { "permission": { "resource": "role", "action": "read" } },
      { "permission": { "resource": "permission", "action": "read" } }
    ]
  }
}
```

### Alternative: Using Wildcards

If you prefer fewer permission records, you could use wildcards:

```bash
# Permission 1: All user actions
POST /roles/permissions
{
  "name": "all_user_actions",
  "resource": "user",
  "action": "*",
  "description": "All actions on user resource"
}

# Permission 2: Read and update products (still need separate or use wildcard)
# Option A: Use wildcard for all product actions
POST /roles/permissions
{
  "name": "all_product_actions",
  "resource": "product",
  "action": "*",
  "description": "All actions on product resource"
}

# Option B: Or keep granular control
POST /roles/permissions
{ "name": "read_products", "resource": "product", "action": "read" }
POST /roles/permissions
{ "name": "update_products", "resource": "product", "action": "update" }

# Permission 3: Read all resources
POST /roles/permissions
{
  "name": "read_all",
  "resource": "*",
  "action": "read",
  "description": "Read access to all resources"
}
```

**Note:** The wildcard approach (`resource: "*"`, `action: "read"`) grants read access to ALL resources, which might be more than you need. Use it carefully.

---

## Notes

1. **Authentication:** All endpoints require a valid JWT token in the Authorization header.
2. **Authorization:** All endpoints require the user to have the `ADMIN` role.
3. **CSRF Protection:** All endpoints skip CSRF protection (as indicated by `@SkipCsrf()` decorator).
4. **Caching:** All endpoints include cache-control headers to prevent caching.
5. **Audit Logging:** All create, update, and delete operations are logged in the audit log system.
6. **Pagination:** List endpoints support optional pagination. If pagination parameters are provided, the response includes metadata. Otherwise, it returns a simple array.
7. **Transaction Safety:** Permission assignment uses database transactions to ensure data consistency.

