/**
 * Log Sanitization Utility
 * 
 * ERROR HANDLING & LOGGING CHECKLIST ITEMS #2, #6:
 * - Prevents log injection attacks by sanitizing user input
 * - Removes sensitive data from logs (passwords, tokens, etc.)
 * - Encodes special characters that could manipulate log files
 * 
 * Security Features:
 * 1. Removes newlines and control characters (prevents log injection)
 * 2. Strips sensitive data patterns (passwords, tokens, credit cards)
 * 3. Truncates long strings to prevent log flooding
 * 4. Encodes ANSI escape codes
 */

export class LogSanitizer {
  // Patterns for sensitive data that should never be logged
  private static readonly SENSITIVE_PATTERNS = [
    /password["\s:=]+[\w\S]+/gi,
    /token["\s:=]+[\w\S]+/gi,
    /authorization["\s:=]+[\w\S]+/gi,
    /bearer\s+[\w\-\.]+/gi,
    /api[_-]?key["\s:=]+[\w\S]+/gi,
    /secret["\s:=]+[\w\S]+/gi,
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card numbers
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  ];

  // Sensitive field names that should be masked
  private static readonly SENSITIVE_FIELDS = [
    'password',
    'newPassword',
    'oldPassword',
    'currentPassword',
    'token',
    'accessToken',
    'refreshToken',
    'csrfToken',
    'sessionToken',
    'secret',
    'apiKey',
    'api_key',
    'authorization',
    'creditCard',
    'cvv',
    'ssn',
  ];

  /**
   * Sanitize a log message to prevent injection and remove sensitive data
   */
  static sanitizeMessage(message: string, maxLength = 1000): string {
    if (typeof message !== 'string') {
      message = String(message);
    }

    // 1. Remove newlines and carriage returns (prevents log injection)
    let sanitized = message.replace(/[\r\n]+/g, ' | ');

    // 2. Remove ANSI escape codes (prevents terminal manipulation)
    sanitized = sanitized.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

    // 3. Remove other control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // 4. Remove sensitive data patterns
    for (const pattern of this.SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    // 5. Truncate if too long (prevents log flooding)
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '... [truncated]';
    }

    return sanitized;
  }

  /**
   * Sanitize an object before logging (masks sensitive fields)
   */
  static sanitizeObject<T = any>(obj: T, maxDepth = 5, currentDepth = 0): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Prevent infinite recursion
    if (currentDepth >= maxDepth) {
      return '[Max depth reached]';
    }

    // Handle primitive types
    if (typeof obj !== 'object') {
      return typeof obj === 'string' ? this.sanitizeMessage(obj) : obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, maxDepth, currentDepth + 1));
    }

    // Handle objects
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Check if field name is sensitive
      if (this.isSensitiveField(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Recursively sanitize nested objects
      if (value !== null && typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value, maxDepth, currentDepth + 1);
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeMessage(value, 500);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Check if a field name is sensitive
   */
  private static isSensitiveField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase();
    return this.SENSITIVE_FIELDS.some(sensitive => 
      lowerField.includes(sensitive.toLowerCase())
    );
  }

  /**
   * Sanitize user input for logging (combines message and object sanitization)
   */
  static sanitizeUserInput(input: any): string {
    if (typeof input === 'string') {
      return this.sanitizeMessage(input);
    }

    if (typeof input === 'object') {
      const sanitized = this.sanitizeObject(input);
      return JSON.stringify(sanitized);
    }

    return String(input);
  }

  /**
   * Create a safe log context with common fields
   */
  static createLogContext(data: {
    userId?: number;
    action?: string;
    resource?: string;
    ipAddress?: string;
    userAgent?: string;
    details?: any;
  }): any {
    return {
      timestamp: new Date().toISOString(),
      userId: data.userId,
      action: data.action ? this.sanitizeMessage(data.action, 100) : undefined,
      resource: data.resource ? this.sanitizeMessage(data.resource, 100) : undefined,
      ipAddress: data.ipAddress ? this.sanitizeIPAddress(data.ipAddress) : undefined,
      userAgent: data.userAgent ? this.sanitizeUserAgent(data.userAgent) : undefined,
      details: data.details ? this.sanitizeObject(data.details, 3) : undefined,
    };
  }

  /**
   * Sanitize IP address (keep first 3 octets for IPv4, first 4 groups for IPv6)
   */
  private static sanitizeIPAddress(ip: string): string {
    // For privacy, we might want to mask last octet
    // But for security logging, we keep full IP
    // Adjust based on your privacy policy
    return this.sanitizeMessage(ip, 45);
  }

  /**
   * Sanitize user agent (remove potentially malicious content)
   */
  private static sanitizeUserAgent(userAgent: string): string {
    return this.sanitizeMessage(userAgent, 200);
  }

  /**
   * Format error for logging (removes sensitive data from error stack)
   */
  static sanitizeError(error: Error | any): any {
    if (!error) return null;

    const sanitized: any = {
      name: error.name || 'Error',
      message: this.sanitizeMessage(error.message || 'Unknown error', 500),
    };

    // Include stack trace but sanitize it
    if (error.stack) {
      sanitized.stack = this.sanitizeMessage(error.stack, 2000);
    }

    // Include any additional properties but sanitize them
    const additionalProps = { ...error };
    delete additionalProps.name;
    delete additionalProps.message;
    delete additionalProps.stack;

    if (Object.keys(additionalProps).length > 0) {
      sanitized.additional = this.sanitizeObject(additionalProps, 2);
    }

    return sanitized;
  }
}

/**
 * Helper function for quick message sanitization
 */
export function sanitizeLog(message: string): string {
  return LogSanitizer.sanitizeMessage(message);
}

/**
 * Helper function for quick object sanitization
 */
export function sanitizeLogObject<T = any>(obj: T): any {
  return LogSanitizer.sanitizeObject(obj);
}

