import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Custom exception filter for validation errors
 * Formats validation errors to match the API documentation format
 */
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const exceptionResponse = exception.getResponse();

    // Check if this is a validation error from ValidationPipe
    // ValidationPipe throws BadRequestException with message as array of validation errors
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse &&
      Array.isArray((exceptionResponse as any).message)
    ) {
      // Format validation errors according to API documentation
      const validationErrors = (exceptionResponse as any).message.map(
        (error: string | any) => {
          // class-validator returns objects with 'property' and 'constraints'
          if (typeof error === 'object' && error !== null && 'property' in error) {
            const constraints = error.constraints || {};
            // Get the first constraint message
            const message = Object.values(constraints)[0] as string || 'Validation failed';
            return {
              field: error.property,
              message: message,
            };
          }

          // If error is a string, try to extract field name
          if (typeof error === 'string') {
            // Try to extract field name from error message
            // Format: "propertyName should not be empty" -> field: "propertyName"
            const fieldMatch = error.match(/^(\w+)/);
            const field = fieldMatch ? fieldMatch[1] : 'unknown';
            return {
              field,
              message: error,
            };
          }

          return {
            field: 'unknown',
            message: String(error),
          };
        },
      );

      // Send response and prevent other filters from handling it
      response.status(HttpStatus.BAD_REQUEST).json({
        version: '1',
        code: 400,
        status: false,
        message: 'Validation failed',
        validationErrors,
        data: null,
      });
      return;
    }

    // If not a validation error, let the global exception filter handle it
    // by not sending a response, the exception will propagate
    throw exception;
  }
}

