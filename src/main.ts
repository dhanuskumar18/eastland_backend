import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS Configuration
  app.enableCors({
    origin: [
      'http://localhost:5002',
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
  app.useGlobalPipes(new ValidationPipe(
    {
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }
  ));
  const port = process.env.PORT ?? 5000;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}`);
}
bootstrap();
