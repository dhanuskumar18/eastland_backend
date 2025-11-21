import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsValidJsonContent } from '../../common/validators/json-content.validator';

/**
 * VALIDATION CHECKLIST ITEM #3: Structured Input Validation
 * 
 * Section content is validated as a proper JSON object structure.
 * This prevents injection of invalid data types and ensures type safety.
 * 
 * Security: Content must be a valid object (not null, not array, not primitive)
 * This prevents type confusion attacks and ensures data integrity.
 */
export class SectionTranslationInput {
  @IsString()
  locale: string;

  // VALIDATION CHECKLIST ITEM #3: Structured inputs checked against schema/strict typing
  // Security: Validates that content is a valid JSON object before processing
  // Prevents injection of null, arrays, or primitives that could cause type confusion
  @IsValidJsonContent({
    allowEmpty: true, // Allow empty objects for flexibility
    message: 'Section content must be a valid JSON object',
  })
  content: Record<string, any>;
}

export class CreateSectionDto {
  @IsString()
  name: string;

  @IsInt()
  pageId: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionTranslationInput)
  translations?: SectionTranslationInput[];
}


