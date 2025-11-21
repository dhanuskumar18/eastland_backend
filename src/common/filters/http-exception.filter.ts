import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LogSanitizer } from '../utils/log-sanitizer.util';
import * as crypto from 'crypto';

/**
 * Global HTTP Exception Filter
 * 
 * ERROR HANDLING & LOGGING CHECKLIST ITEMS #8, #9:
 * - Provides generic error messages to users (no internal details exposed)
 * - Implements consistent exception handling across the application
 * - Generates error IDs for tracking and support
 * - Logs errors with sanitized data
 * 
 * Security Features:
 * 1. Never exposes internal error details to clients
 * 2. Generates unique error IDs for tracking
 * 3. Sanitizes all error data before logging
 * 4. Provides different detail levels based on environment
 */

interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  error?: string;
  errorId?: string;
  timestamp: string;
  path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determine status code
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Generate unique error ID for tracking
    const errorId = this.generateErrorId();

    // Get error details
    const errorDetails = this.getErrorDetails(exception);

    // Determine if we should show detailed errors (dev mode only)
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Create user-facing error response
    const errorResponse: ErrorResponse = {
      success: false,
      statusCode: status,
      message: this.getUserMessage(exception, status),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Add error ID for 500 errors
    if (status >= 500) {
      errorResponse.errorId = errorId;
      errorResponse.message = 'An unexpected error occurred. Please contact support with this error ID if the problem persists.';
    }

    // In development, include more details
    if (isDevelopment && status >= 500) {
      errorResponse.error = errorDetails.message;
    }

    // Log the error with full context (sanitized)
    this.logError(exception, request, status, errorId, errorDetails);

    // Send response
    response.status(status).json(errorResponse);
  }

  /**
   * Get error details from exception
   */
  private getErrorDetails(exception: unknown): {
    message: string;
    stack?: string;
    details?: any;
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      return {
        message: exception.message,
        stack: exception.stack,
        details: typeof response === 'object' ? response : undefined,
      };
    }

    if (exception instanceof Error) {
      return {
        message: exception.message,
        stack: exception.stack,
      };
    }

    return {
      message: String(exception),
    };
  }

  /**
   * Get user-friendly error message
   */
  private getUserMessage(exception: unknown, status: number): string {
    // For 4xx errors, we can be more specific
    if (status < 500) {
      if (exception instanceof HttpException) {
        const response = exception.getResponse();
        
        // If response is an object with a message, use it
        if (typeof response === 'object' && response !== null) {
          const responseObj = response as any;
          
          if (responseObj.message) {
            // If message is an array (validation errors), join them
            if (Array.isArray(responseObj.message)) {
              return responseObj.message.join(', ');
            }
            return responseObj.message;
          }
        }
        
        return exception.message;
      }
    }

    // For 5xx errors, use generic messages
    switch (status) {
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'An unexpected error occurred. Our team has been notified.';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'Service temporarily unavailable. Please try again later.';
      case HttpStatus.GATEWAY_TIMEOUT:
        return 'Request timeout. Please try again.';
      default:
        return 'An error occurred processing your request.';
    }
  }

  /**
   * Log error with sanitized data
   */
  private logError(
    exception: unknown,
    request: Request,
    status: number,
    errorId: string,
    errorDetails: any
  ): void {
    // Get user info from request (if authenticated)
    const user = (request as any).user;
    const userId = user?.id;

    // Create sanitized log context
    const logContext = LogSanitizer.createLogContext({
      userId,
      action: 'HTTP_EXCEPTION',
      resource: `${request.method} ${request.url}`,
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
      details: {
        errorId,
        statusCode: status,
        method: request.method,
        url: request.url,
        query: request.query,
        // Don't log request body as it might contain sensitive data
        // body: request.body,
      },
    });

    // Sanitize error details
    const sanitizedError = LogSanitizer.sanitizeError(exception);

    // Log based on severity
    if (status >= 500) {
      // Server errors - log as error with full details
      this.logger.error(
        `[${errorId}] Server Error: ${sanitizedError.message}`,
        {
          ...logContext,
          error: sanitizedError,
          stack: errorDetails.stack ? LogSanitizer.sanitizeMessage(errorDetails.stack, 2000) : undefined,
        }
      );
    } else if (status >= 400) {
      // Client errors - log as warning
      this.logger.warn(
        `Client Error ${status}: ${sanitizedError.message}`,
        {
          ...logContext,
          error: sanitizedError,
        }
      );
    } else {
      // Other status codes - log as info
      this.logger.log(
        `HTTP ${status}: ${sanitizedError.message}`,
        logContext
      );
    }
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    // Format: ERR-YYYYMMDD-RANDOM
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ERR-${date}-${random}`;
  }
}

