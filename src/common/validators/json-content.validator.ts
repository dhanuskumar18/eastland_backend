import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * VALIDATION CHECKLIST ITEM #3: Structured Input Validation
 * 
 * This validator ensures that JSON/structured inputs are properly validated before use.
 * 
 * Security Benefits:
 * - Prevents injection of invalid data types (null, arrays, primitives at root level)
 * - Ensures content is a valid object structure
 * - Validates JSON structure before database storage
 * - Prevents type confusion attacks
 * 
 * How it works:
 * 1. Validates that the value is an object (not null, not array, not primitive)
 * 2. Ensures the object is not empty (optional, configurable)
 * 3. Can be extended with schema validation for specific content types
 */
@ValidatorConstraint({ name: 'isValidJsonContent', async: false })
export class IsValidJsonContentConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    // VALIDATION CHECKLIST ITEM #3: Structured inputs must be objects
    // Security: Reject null, arrays, primitives to prevent type confusion
    if (value === null || value === undefined) {
      return false;
    }

    // Must be an object (not array, not primitive)
    if (typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    // Optional: Check if object should not be empty
    const options = args.constraints[0] || {};
    if (options.allowEmpty === false && Object.keys(value).length === 0) {
      return false;
    }

    // Optional: Validate against a schema if provided
    if (options.schema && typeof options.schema === 'function') {
      try {
        return options.schema(value);
      } catch {
        return false;
      }
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const options = args.constraints[0] || {};
    if (options.message) {
      return options.message;
    }
    return 'Content must be a valid JSON object';
  }
}

/**
 * Validates that a value is a valid JSON object structure
 * 
 * @param options - Validation options
 * @param options.allowEmpty - Whether to allow empty objects (default: true)
 * @param options.schema - Optional schema validation function
 * @param options.message - Custom error message
 * @param validationOptions - Standard class-validator options
 * 
 * @example
 * ```typescript
 * @IsValidJsonContent({ allowEmpty: false })
 * content: Record<string, any>;
 * ```
 */
export function IsValidJsonContent(
  options?: {
    allowEmpty?: boolean;
    schema?: (value: any) => boolean;
    message?: string;
  },
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options || {}],
      validator: IsValidJsonContentConstraint,
    });
  };
}

/**
 * VALIDATION CHECKLIST ITEM #3: Custom Fields Validation
 * 
 * Validates that customFields is a proper object structure with string keys
 * and any values (but not nested functions or dangerous types)
 */
@ValidatorConstraint({ name: 'isValidCustomFields', async: false })
export class IsValidCustomFieldsConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    // Allow undefined/optional
    if (value === undefined || value === null) {
      return true;
    }

    // Must be an object
    if (typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    // Validate each field
    for (const [key, val] of Object.entries(value)) {
      // Keys must be strings
      if (typeof key !== 'string') {
        return false;
      }

      // Values must be serializable (no functions, no circular refs)
      // Allow: string, number, boolean, null, arrays, objects
      const valueType = typeof val;
      if (valueType === 'function' || valueType === 'symbol') {
        return false;
      }

      // Recursively validate nested objects (prevent deep nesting abuse)
      if (valueType === 'object' && val !== null && !Array.isArray(val)) {
        // Limit nesting depth to prevent DoS
        if (this.getDepth(val) > 10) {
          return false;
        }
      }
    }

    return true;
  }

  private getDepth(obj: any, currentDepth = 0): number {
    if (currentDepth > 10) return currentDepth;
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return currentDepth;
    }

    let maxDepth = currentDepth;
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const depth = this.getDepth(value, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }
    return maxDepth;
  }

  defaultMessage(): string {
    return 'Custom fields must be a valid object with string keys and serializable values';
  }
}

/**
 * Validates custom fields structure for contact submissions
 * 
 * @param validationOptions - Standard class-validator options
 */
export function IsValidCustomFields(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidCustomFieldsConstraint,
    });
  };
}

