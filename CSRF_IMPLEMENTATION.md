# CSRF Token Management Implementation

This document provides a comprehensive guide to the CSRF (Cross-Site Request Forgery) token management system implemented in this NestJS application.

## Overview

The CSRF protection system provides multiple layers of security against cross-site request forgery attacks by implementing:

1. **Token-based CSRF protection** - Standard CSRF tokens stored in database
2. **Double-submit cookie pattern** - Additional security layer using cookies
3. **Session-aware validation** - Tokens tied to user sessions
4. **Automatic cleanup** - Expired tokens are automatically removed
5. **Comprehensive middleware** - Global CSRF protection with selective exclusions

## Architecture

### Components

1. **CsrfService** (`src/auth/csrf/csrf.service.ts`)
   - Token generation and validation
   - Database operations for CSRF tokens
   - Double-submit cookie support
   - Cleanup operations

2. **CsrfGuard** (`src/auth/csrf/csrf.guard.ts`)
   - Route-level CSRF protection
   - Skip decorator support
   - Session and user extraction

3. **CsrfMiddleware** (`src/auth/csrf/csrf.middleware.ts`)
   - Global CSRF protection
   - Request validation
   - Error handling

4. **Database Model** (`prisma/schema.prisma`)
   - CsrfToken model for persistence
   - Indexes for performance
   - Relationships with sessions/users

## API Endpoints

### CSRF Token Management

#### Get CSRF Token (Anonymous)
```http
GET /auth/csrf-token
```
- **Purpose**: Get a CSRF token for anonymous users
- **Rate Limit**: 10 requests per minute
- **Response**: `{ csrfToken: string }`

#### Get CSRF Token (Authenticated)
```http
GET /auth/csrf-token/authenticated
Authorization: Bearer <access_token>
```
- **Purpose**: Get a CSRF token for authenticated users
- **Rate Limit**: 20 requests per minute
- **Response**: `{ csrfToken: string }`

#### Get Double-Submit CSRF Token
```http
GET /auth/csrf-token/double-submit
```
- **Purpose**: Get CSRF token with double-submit cookie pattern
- **Rate Limit**: 10 requests per minute
- **Response**: `{ csrfToken: string }`
- **Sets Cookie**: `csrf-token` (HTTP-only, secure, same-site strict)

#### Validate CSRF Token
```http
POST /auth/csrf-token/validate
Content-Type: application/json

{
  "token": "your-csrf-token"
}
```
- **Purpose**: Validate a CSRF token
- **Rate Limit**: 30 requests per minute
- **Response**: `{ valid: boolean, message: string }`

#### Revoke Session CSRF Tokens
```http
POST /auth/csrf-token/revoke-session
Authorization: Bearer <access_token>
```
- **Purpose**: Revoke all CSRF tokens for current session
- **Rate Limit**: 5 requests per minute
- **Response**: `{ message: string, revokedCount: number }`

#### Revoke All CSRF Tokens
```http
POST /auth/csrf-token/revoke-all
Authorization: Bearer <access_token>
```
- **Purpose**: Revoke all CSRF tokens for current user
- **Rate Limit**: 3 requests per minute
- **Response**: `{ message: string, revokedCount: number }`

## Usage Examples

### Frontend Implementation

#### Basic CSRF Protection
```javascript
// Get CSRF token
async function getCsrfToken() {
  const response = await fetch('/auth/csrf-token');
  const data = await response.json();
  return data.csrfToken;
}

// Make protected request
async function makeProtectedRequest(data) {
  const csrfToken = await getCsrfToken();
  
  const response = await fetch('/api/protected-endpoint', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(data),
  });
  
  return response.json();
}
```

#### Double-Submit Cookie Pattern
```javascript
// Get double-submit CSRF token
async function getDoubleSubmitToken() {
  const response = await fetch('/auth/csrf-token/double-submit');
  const data = await response.json();
  return data.csrfToken;
}

// Make protected request with double-submit
async function makeProtectedRequestWithDoubleSubmit(data) {
  const csrfToken = await getDoubleSubmitToken();
  
  const response = await fetch('/api/protected-endpoint', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include', // Include cookies
    body: JSON.stringify(data),
  });
  
  return response.json();
}
```

#### Cross-Tab Token Synchronization
```javascript
class CsrfTokenManager {
  constructor() {
    this.token = null;
    this.setupStorageListener();
  }

  async getToken() {
    if (!this.token) {
      this.token = await this.fetchToken();
      this.broadcastToken();
    }
    return this.token;
  }

  async fetchToken() {
    const response = await fetch('/auth/csrf-token');
    const data = await response.json();
    return data.csrfToken;
  }

  setupStorageListener() {
    // Listen for token updates from other tabs
    window.addEventListener('storage', (e) => {
      if (e.key === 'csrf-token-sync') {
        this.token = e.newValue;
      }
    });
  }

  broadcastToken() {
    // Notify other tabs
    localStorage.setItem('csrf-token-sync', this.token);
    localStorage.removeItem('csrf-token-sync');
  }
}
```

### Backend Implementation

#### Using CSRF Guards
```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { CsrfGuard, SkipCsrf } from '../auth/csrf';

@Controller('api')
export class ApiController {
  
  // Protected endpoint
  @UseGuards(CsrfGuard)
  @Post('protected')
  async protectedEndpoint() {
    return { message: 'Protected by CSRF' };
  }

  // Skip CSRF for specific endpoint
  @SkipCsrf()()
  @Post('public')
  async publicEndpoint() {
    return { message: 'Not protected by CSRF' };
  }
}
```

#### Custom CSRF Validation
```typescript
import { Injectable } from '@nestjs/common';
import { CsrfService } from '../auth/csrf/csrf.service';

@Injectable()
export class CustomService {
  constructor(private csrfService: CsrfService) {}

  async validateCustomToken(token: string, sessionId: string) {
    return this.csrfService.validateToken(token, sessionId);
  }

  async generateCustomToken(sessionId: string) {
    return this.csrfService.generateSessionToken(sessionId);
  }
}
```

## Configuration

### Environment Variables
```env
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
```

### Middleware Configuration
The CSRF middleware is configured in `src/app.module.ts`:

```typescript
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CsrfMiddleware)
      .exclude(
        'auth/csrf-token*', // Exclude CSRF token endpoints
        'auth/login',       // Exclude login
        'auth/signup',      // Exclude signup
        'auth/refresh',     // Exclude refresh
        'auth/forgot-password',
        'auth/verify-otp',
        'auth/reset-password',
      )
      .forRoutes('*');
  }
}
```

### Database Configuration
The CSRF token table is automatically created via Prisma migration:

```sql
CREATE TABLE "CsrfToken" (
  "id" SERIAL PRIMARY KEY,
  "token" VARCHAR NOT NULL UNIQUE,
  "sessionId" VARCHAR,
  "userId" INTEGER,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON "CsrfToken"("token");
CREATE INDEX ON "CsrfToken"("sessionId");
CREATE INDEX ON "CsrfToken"("userId");
CREATE INDEX ON "CsrfToken"("expiresAt");
```

## Security Features

### Token Expiration
- CSRF tokens expire after 30 minutes
- Automatic cleanup every 30 minutes
- Tokens are validated against expiration time

### Session Binding
- Tokens can be bound to specific sessions
- Session invalidation revokes associated tokens
- User-specific token management

### Rate Limiting
- Different rate limits for different endpoints
- Prevents token abuse
- Configurable per endpoint

### Double-Submit Cookie Pattern
- Additional security layer
- Cookie value must match token
- HTTP-only cookies prevent XSS attacks

## Maintenance

### Automatic Cleanup
The system includes automatic cleanup of expired tokens:

```typescript
// Runs every 30 minutes
@Cron('0 */30 * * * *')
async cleanupExpiredCsrfTokens() {
  const cleanedCount = await this.csrfService.cleanupExpiredTokens();
  this.logger.log(`CSRF token cleanup completed. Cleaned ${cleanedCount} tokens.`);
}
```

### Manual Cleanup
You can manually clean up tokens:

```typescript
// Clean up expired tokens
await csrfService.cleanupExpiredTokens();

// Revoke all tokens for a user
await csrfService.revokeUserTokens(userId);

// Revoke all tokens for a session
await csrfService.revokeSessionTokens(sessionId);
```

## Best Practices

### Frontend
1. **Always include CSRF tokens** in state-changing requests
2. **Refresh tokens** before they expire (check expiration time)
3. **Handle token validation errors** gracefully
4. **Use HTTPS** in production for secure cookie transmission
5. **Implement token synchronization** across browser tabs

### Backend
1. **Use appropriate guards** for different protection levels
2. **Skip CSRF** only for safe endpoints (GET, HEAD, OPTIONS)
3. **Monitor token usage** and cleanup patterns
4. **Implement proper error handling** for CSRF failures
5. **Use double-submit pattern** for high-security applications

### Security Considerations
1. **Never expose CSRF tokens** in URLs or logs
2. **Use HTTPS** in production environments
3. **Implement proper session management** alongside CSRF
4. **Monitor for suspicious activity** patterns
5. **Regular security audits** of token implementation

## Troubleshooting

### Common Issues

#### "CSRF token missing" Error
- Ensure the `X-CSRF-Token` header is included in requests
- Check that the token endpoint is accessible
- Verify middleware configuration

#### "Invalid CSRF token" Error
- Token may have expired (30-minute lifetime)
- Session may have changed
- Token may not match the expected session/user

#### Token Not Persisting Across Tabs
- Implement cross-tab synchronization using BroadcastChannel or localStorage
- Consider using sessionStorage for tab-specific tokens
- Implement automatic token refresh

### Debugging
Enable debug logging to troubleshoot CSRF issues:

```typescript
// In your service
this.logger.debug(`CSRF token validation: ${token} for session: ${sessionId}`);
```

## Migration Guide

### From No CSRF Protection
1. Add CSRF middleware to your application
2. Update frontend to include CSRF tokens in requests
3. Test all protected endpoints
4. Configure appropriate exclusions

### From Basic CSRF to Advanced
1. Implement session-aware tokens
2. Add double-submit cookie pattern
3. Implement cross-tab synchronization
4. Add comprehensive cleanup

This CSRF implementation provides enterprise-grade protection against cross-site request forgery attacks while maintaining ease of use and flexibility for different application requirements.
