/**
 * Common validation utility functions
 * Consolidates repeated validation logic throughout the application
 */

// String validation utilities
export const isEmptyOrWhitespace = (value: string | null | undefined): boolean => {
  return !value || value.trim().length === 0;
};

export const hasMinLength = (value: string, minLength: number): boolean => {
  return value.trim().length >= minLength;
};

export const hasMaxLength = (value: string, maxLength: number): boolean => {
  return value.trim().length <= maxLength;
};

export const isValidLength = (value: string, minLength: number, maxLength: number): boolean => {
  const trimmedLength = value.trim().length;
  return trimmedLength >= minLength && trimmedLength <= maxLength;
};

// Array validation utilities
export const isEmptyArray = <T>(array: T[] | null | undefined): boolean => {
  return !array || array.length === 0;
};

export const hasMinItems = <T>(array: T[], minItems: number): boolean => {
  return array.length >= minItems;
};

// Object validation utilities
export const isEmptyObject = (obj: Record<string, any> | null | undefined): boolean => {
  return !obj || Object.keys(obj).length === 0;
};

export const hasRequiredFields = (obj: Record<string, any>, requiredFields: string[]): boolean => {
  return requiredFields.every(field => obj.hasOwnProperty(field) && obj[field] !== null && obj[field] !== undefined);
};

// File validation utilities
export const isValidFileType = (file: File, allowedTypes: string[]): boolean => {
  return allowedTypes.includes(file.type);
};

export const isValidFileSize = (file: File, maxSizeBytes: number): boolean => {
  return file.size <= maxSizeBytes;
};

export const getFileExtension = (fileName: string): string => {
  return fileName.split('.').pop()?.toLowerCase() || '';
};

export const isValidFileExtension = (fileName: string, allowedExtensions: string[]): boolean => {
  const extension = getFileExtension(fileName);
  return allowedExtensions.includes(extension);
};

// URL validation utilities
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidHttpUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

// Email validation utility
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

// Group name validation (specific to this application)
export interface GroupNameValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateGroupName = (
  name: string, 
  existingNames: string[] = [],
  caseSensitive: boolean = false
): GroupNameValidationResult => {
  if (isEmptyOrWhitespace(name)) {
    return { isValid: false, error: 'Group name is required' };
  }

  if (!hasMinLength(name, 1)) {
    return { isValid: false, error: 'Group name cannot be empty' };
  }

  if (!hasMaxLength(name, 100)) {
    return { isValid: false, error: 'Group name must be 100 characters or less' };
  }

  // Check for duplicate names
  const comparison = caseSensitive ? 
    (existing: string) => existing === name.trim() :
    (existing: string) => existing.toLowerCase() === name.trim().toLowerCase();

  if (existingNames.some(comparison)) {
    return { isValid: false, error: 'A group with this name already exists' };
  }

  // Check for invalid characters (optional - can be customized)
  const invalidChars = /[<>:"\\|?*]/;
  if (invalidChars.test(name)) {
    return { isValid: false, error: 'Group name contains invalid characters' };
  }

  return { isValid: true };
};

// Form validation result type
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// Form validation helper
export const createValidationResult = (errors: Record<string, string> = {}): ValidationResult => {
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Session metadata validation
export interface SessionMetadata {
  userId: string;
  sessionId?: string;
  groupId?: string;
  notes?: string;
}

export const validateSessionMetadata = (metadata: SessionMetadata): ValidationResult => {
  const errors: Record<string, string> = {};

  if (isEmptyOrWhitespace(metadata.userId)) {
    errors.userId = 'User ID is required';
  }

  if (metadata.notes && !hasMaxLength(metadata.notes, 500)) {
    errors.notes = 'Notes must be 500 characters or less';
  }

  return createValidationResult(errors);
};

// Batch validation utility
export const validateBatch = <T>(
  items: T[],
  validator: (item: T, index: number) => ValidationResult
): { isValid: boolean; errors: Array<{ index: number; errors: Record<string, string> }> } => {
  const errors: Array<{ index: number; errors: Record<string, string> }> = [];

  items.forEach((item, index) => {
    const result = validator(item, index);
    if (!result.isValid) {
      errors.push({ index, errors: result.errors });
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};