import { BadRequestException } from '@nestjs/common';

/**
 * Common weak passwords list
 * This is a basic list - in production, you might want to use a more comprehensive list
 * or integrate with a service like Have I Been Pwned API
 */
const COMMON_WEAK_PASSWORDS = [
  'password',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'abc123',
  'monkey',
  '1234567',
  'letmein',
  'trustno1',
  'dragon',
  'baseball',
  'iloveyou',
  'master',
  'sunshine',
  'ashley',
  'bailey',
  'passw0rd',
  'shadow',
  '123123',
  '654321',
  'superman',
  'qazwsx',
  'michael',
  'football',
  'welcome',
  'jesus',
  'ninja',
  'mustang',
  'password1',
  'root',
  'admin',
  'administrator',
  '1234',
  '12345',
  '123456',
  'admin123',
  'root123',
];

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export class PasswordValidator {
  /**
   * Validate password according to security requirements:
   * - Minimum 12 characters
   * - Maximum 128 characters (but allow up to 64 for practical use)
   * - Must contain lowercase, uppercase, number, and special character
   * - Must not be a common weak password
   */
  static validate(password: string): PasswordValidationResult {
    const errors: string[] = [];

    // Check minimum length (12 characters)
    if (password.length < 12) {
      errors.push('Password must be at least 12 characters long');
    }

    // Check maximum length (128 characters, but warn if over 64)
    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }

    // Check for required character types
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!hasLowercase) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!hasUppercase) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!hasNumber) {
      errors.push('Password must contain at least one number');
    }

    if (!hasSpecialChar) {
      errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':"\\|,.<>/?])');
    }

    // Check against common weak passwords
    const normalizedPassword = password.toLowerCase().trim();
    if (COMMON_WEAK_PASSWORDS.includes(normalizedPassword)) {
      errors.push('Password is too common or weak. Please choose a stronger password');
    }

    // Check for common patterns (e.g., "password123", "admin123")
    const isCommonPattern = COMMON_WEAK_PASSWORDS.some(weak => 
      normalizedPassword.includes(weak) || normalizedPassword.startsWith(weak)
    );
    
    if (isCommonPattern && password.length < 16) {
      errors.push('Password contains common patterns. Please choose a more unique password');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if password meets minimum requirements (for display purposes)
   */
  static getPasswordStrength(password: string): {
    score: number;
    label: string;
    meetsRequirements: boolean;
  } {
    if (password.length === 0) {
      return { score: 0, label: '', meetsRequirements: false };
    }

    const validation = this.validate(password);
    
    if (validation.isValid) {
      // Calculate strength score based on length and complexity
      let score = 0;
      
      // Length score (0-3)
      if (password.length >= 12) score += 1;
      if (password.length >= 16) score += 1;
      if (password.length >= 20) score += 1;
      
      // Complexity score (0-4)
      if (/[a-z]/.test(password)) score += 1;
      if (/[A-Z]/.test(password)) score += 1;
      if (/\d/.test(password)) score += 1;
      if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;
      
      // Bonus for longer passwords
      if (password.length >= 24) score += 1;
      
      let label = 'Very Weak';
      if (score >= 7) label = 'Strong';
      else if (score >= 5) label = 'Good';
      else if (score >= 3) label = 'Fair';
      else if (score >= 1) label = 'Weak';
      
      return { score, label, meetsRequirements: true };
    }

    // If validation fails, determine why
    let score = 0;
    if (password.length >= 8) score = 1;
    if (password.length >= 12) score = 2;
    
    return { score, label: 'Does not meet requirements', meetsRequirements: false };
  }
}

