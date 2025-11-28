import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
// @ts-ignore - compression is a CommonJS module
const compression = require('compression');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['log', 'error', 'warn', 'debug'],
  });
  
  // Note: Global prefix removed to maintain backward compatibility
  // SEO routes use 'api/seo' prefix in controller
  // Other routes remain at their original paths (e.g., /auth/login)
  
  // CORS Configuration
  app.enableCors({
    origin: [
      'http://localhost:5002',
      'http://localhost:5004',
      'http://localhost:3000',
      'https://eastland-website.vercel.app',
      'https://eastlandadmin.webnoxdigital.com',
      'http://localhost:8000',
      'http://localhost:3001',
      'http://localhost:5173', // Vite default port
      'http://localhost:4200', // Angular default port
      'http://localhost:8080', // Vue default port
      'http://127.0.0.1:5000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4200',
      'http://127.0.0.1:8080',
      // Add production domains here
      // 'https://yourdomain.com',
      // 'https://www.yourdomain.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'Pragma',
      'X-CSRF-Token',
    ],
    credentials: true, // Allow cookies and authorization headers
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.use(cookieParser());
  
  // CONFIGURATION CHECKLIST ITEMS #10-14: Security Headers
  // Configure helmet for comprehensive security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'", "https://www.google.com", "https://www.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        connectSrc: ["'self'"],
        frameSrc: ["'self'", "https://www.google.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny', // X-Frame-Options: DENY
    },
    noSniff: true, // X-Content-Type-Options: nosniff
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    xssFilter: true, // X-XSS-Protection (legacy, but still useful)
    permittedCrossDomainPolicies: false,
  }));
  
  // Enable compression for all responses (gzip/deflate)
  // This significantly reduces response size and improves performance
  app.use(compression({
    threshold: 1024, // Only compress responses larger than 1KB
    level: 6, // Compression level (0-9, 6 is a good balance)
    filter: (req, res) => {
      // Don't compress if the client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Compress all other responses
      return true;
    },
  }));
  
  // ACCESS CONTROL CHECKLIST ITEM #7: Directory Browsing Protection
  // Serve static files from uploads directory with directory browsing disabled
  // Security: Directory browsing is disabled to prevent enumeration of files
  // Only specific files can be accessed via direct URL, not directory listings
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
    // Directory browsing is disabled by default in NestJS static assets
    // This prevents users from listing directory contents
    // Only files with known paths can be accessed
    index: false, // Disable index file serving (prevents directory listing)
    dotfiles: 'deny', // Deny access to dotfiles (hidden files like .env, .git, etc.)
  });

  // VALIDATION CHECKLIST ITEM #1 & #2: Input Validation & Allow Lists
  // ValidationPipe with whitelist ensures only expected properties are accepted
  // Security: Prevents injection of unexpected fields and validates all inputs
  // - whitelist: true - Strips non-whitelisted properties
  // - forbidNonWhitelisted: true - Rejects requests with unexpected properties
  // - transform: true - Transforms payloads to DTO instances
  // - stopAtFirstError: false - Returns all validation errors at once
  app.useGlobalPipes(new ValidationPipe(
    {
      whitelist: true, // VALIDATION CHECKLIST ITEM #2: Allow lists - only expected properties allowed
      forbidNonWhitelisted: true, // Reject requests with unexpected properties
      transform: true, // Transform payloads to DTO instances for type safety
      transformOptions: {
        enableImplicitConversion: true, // Convert string numbers to numbers, etc.
      },
      stopAtFirstError: false, // Return all validation errors for better UX
    }
  ));
  const port = process.env.PORT || 5003;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Application is running on: http://0.0.0.0:${port}`);
}
bootstrap();
