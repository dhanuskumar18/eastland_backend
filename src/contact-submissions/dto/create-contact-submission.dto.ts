import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';
import { IsValidCustomFields } from '../../common/validators/json-content.validator';

/**
 * VALIDATION CHECKLIST ITEM #3: Structured Input Validation
 * 
 * Contact submission DTO with proper validation for structured inputs.
 * Custom fields are validated to ensure they are proper objects with serializable values.
 */
export class CreateContactSubmissionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  // VALIDATION CHECKLIST ITEM #3: Structured inputs checked against schema/strict typing
  // Security: Validates customFields is a proper object structure
  // Prevents injection of functions, symbols, or deeply nested objects that could cause issues
  // Limits nesting depth to prevent DoS attacks
  @IsValidCustomFields({
    message: 'Custom fields must be a valid object with string keys and serializable values',
  })
  @IsOptional()
  customFields?: Record<string, any>;
}

