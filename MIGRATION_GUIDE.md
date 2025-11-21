# Error Handling & Logging Migration Guide

## Quick Start

Run these commands to apply the error handling and logging implementation:

### 1. Generate Prisma Client (Already Done ✅)
```bash
cd eastland_backend
npx prisma generate
```

### 2. Create and Apply Migration
```bash
npx prisma migrate dev --name add_audit_logging
```

This will:
- Create the `AuditLog` table
- Add all necessary indexes
- Update the Prisma client

### 3. Restart Server
```bash
# Development
npm run start:dev

# OR Production
npm run build
npm run start:prod
```

---

## What Will Happen

### Database Changes
The migration will create a new table:

```sql
CREATE TABLE "AuditLog" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER,
  "action" TEXT NOT NULL,
  "resource" TEXT,
  "resourceId" INTEGER,
  "details" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "status" TEXT DEFAULT 'SUCCESS',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_resource_idx" ON "AuditLog"("resource");
CREATE INDEX "AuditLog_resourceId_idx" ON "AuditLog"("resourceId");
CREATE INDEX "AuditLog_status_idx" ON "AuditLog"("status");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
```

### No Data Loss
- This migration only **adds** new functionality
- No existing tables are modified
- No data is deleted or changed
- 100% safe to run on production

---

## Verification

After running the migration, verify it worked:

### 1. Check Database
```sql
-- Verify table exists
SELECT * FROM "AuditLog" LIMIT 1;

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'AuditLog';
```

### 2. Check Server Logs
Look for these messages when server starts:
```
🚀 Application is running on: http://0.0.0.0:5003
```

No errors should appear related to AuditLog.

### 3. Test Audit Logging
```bash
# Create a test user (as admin)
curl -X POST http://localhost:5003/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "Test123!@#",
    "role": "USER"
  }'

# Check if audit log was created
psql $DATABASE_URL -c "SELECT * FROM \"AuditLog\" ORDER BY \"createdAt\" DESC LIMIT 1;"
```

---

## Rollback (If Needed)

If something goes wrong, you can rollback:

```bash
# Rollback the last migration
npx prisma migrate resolve --rolled-back add_audit_logging

# Or manually drop the table
psql $DATABASE_URL -c 'DROP TABLE "AuditLog";'
```

---

## Troubleshooting

### Error: "Table already exists"
The table was already created. Skip the migration or reset it:
```bash
npx prisma migrate resolve --applied add_audit_logging
```

### Error: "Cannot connect to database"
Check your `.env` file and ensure `DATABASE_URL` is correct:
```bash
cat .env | grep DATABASE_URL
```

### Error: "Prisma Client not generated"
Regenerate the Prisma client:
```bash
npx prisma generate
```

### Server Won't Start
Check for TypeScript errors:
```bash
npm run build
```

---

## What's New

### Services
- ✅ `AuditLogService` - Available globally for logging
- ✅ `LogSanitizer` - Available as utility class

### Endpoints (No new endpoints)
All existing endpoints now include:
- Audit logging for sensitive operations
- Improved error messages
- Error ID generation for 500 errors

### Usage in Code
```typescript
import { AuditLogService, AuditAction } from '../common/services/audit-log.service';
import { LogSanitizer } from '../common/utils/log-sanitizer.util';

// In any service
constructor(private auditLog: AuditLogService) {}

// Log an action
await this.auditLog.logSuccess({
  userId: user.id,
  action: AuditAction.USER_CREATED,
  resource: 'User',
  resourceId: newUser.id,
  details: { email: newUser.email },
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
});
```

---

## Support

If you encounter issues:
1. Check server logs: `pm2 logs` or console output
2. Check database logs: `psql $DATABASE_URL`
3. Review implementation guide: `ERROR_HANDLING_LOGGING_IMPLEMENTATION.md`
4. Check summary: `ERROR_HANDLING_LOGGING_SUMMARY.md`

---

**Ready to migrate?** Run the commands at the top of this file!

