/**
 * Validation Utilities
 * Provides runtime type checking and validation for forms and API data
 */

import { Permission } from './permissions';
import { logger } from './debug-logger';

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Validation schema interfaces
export interface RoleValidationData {
  name: string;
  description?: string;
  department_id: string;
  permissions: Record<Permission, boolean>;
  reporting_role_id?: string;
}

export interface UserValidationData {
  name: string;
  email: string;
  bio?: string;
  skills?: string[];
}

export interface DepartmentValidationData {
  name: string;
  description?: string;
}

export interface UserRoleAssignmentData {
  user_id: string;
  role_id: string;
  assigned_by: string;
}

// Validation functions
export function validateRole(data: Partial<RoleValidationData>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  logger.debug('Validating role data', { action: 'validation', function: 'validateRole' });

  // Required fields
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Role name is required and must be a non-empty string');
  } else if (data.name.length > 100) {
    errors.push('Role name must be 100 characters or less');
  }

  if (!data.department_id || typeof data.department_id !== 'string') {
    errors.push('Department ID is required');
  }

  // Optional fields validation
  if (data.description && data.description.length > 500) {
    warnings.push('Description is quite long (over 500 characters)');
  }

  if (data.reporting_role_id && data.reporting_role_id === data.department_id) {
    errors.push('Role cannot report to itself');
  }

  // Permissions validation
  if (data.permissions) {
    const validPermissions = Object.values(Permission);
    const invalidPermissions = Object.keys(data.permissions).filter(
      key => !validPermissions.includes(key as Permission)
    );
    
    if (invalidPermissions.length > 0) {
      errors.push(`Invalid permissions: ${invalidPermissions.join(', ')}`);
    }
  }

  const result: ValidationResult = {
    isValid: errors.length === 0,
    errors,
    warnings,
  };

  logger.debug('Role validation result', { 
    action: 'validation', 
    function: 'validateRole',
    isValid: result.isValid,
    errorCount: errors.length,
    warningCount: warnings.length
  });

  return result;
}

export function validateUser(data: Partial<UserValidationData>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  logger.debug('Validating user data', { action: 'validation', function: 'validateUser' });

  // Required fields
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Name is required and must be a non-empty string');
  } else if (data.name.length > 100) {
    errors.push('Name must be 100 characters or less');
  }

  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Email must be a valid email address');
    } else if (data.email.length > 255) {
      errors.push('Email must be 255 characters or less');
    }
  }

  // Optional fields validation
  if (data.bio && data.bio.length > 1000) {
    warnings.push('Bio is quite long (over 1000 characters)');
  }

  if (data.skills && Array.isArray(data.skills)) {
    if (data.skills.length > 20) {
      warnings.push('User has many skills (over 20)');
    }
    
    const invalidSkills = data.skills.filter(skill => 
      typeof skill !== 'string' || skill.trim().length === 0
    );
    
    if (invalidSkills.length > 0) {
      errors.push('All skills must be non-empty strings');
    }
  }

  const result: ValidationResult = {
    isValid: errors.length === 0,
    errors,
    warnings,
  };

  logger.debug('User validation result', { 
    action: 'validation', 
    function: 'validateUser',
    isValid: result.isValid,
    errorCount: errors.length,
    warningCount: warnings.length
  });

  return result;
}

export function validateDepartment(data: Partial<DepartmentValidationData>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  logger.debug('Validating department data', { action: 'validation', function: 'validateDepartment' });

  // Required fields
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Department name is required and must be a non-empty string');
  } else if (data.name.length > 100) {
    errors.push('Department name must be 100 characters or less');
  }

  // Optional fields validation
  if (data.description && data.description.length > 500) {
    warnings.push('Description is quite long (over 500 characters)');
  }

  const result: ValidationResult = {
    isValid: errors.length === 0,
    errors,
    warnings,
  };

  logger.debug('Department validation result', { 
    action: 'validation', 
    function: 'validateDepartment',
    isValid: result.isValid,
    errorCount: errors.length,
    warningCount: warnings.length
  });

  return result;
}

export function validateUserRoleAssignment(data: Partial<UserRoleAssignmentData>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  logger.debug('Validating user role assignment', { action: 'validation', function: 'validateUserRoleAssignment' });

  // Required fields
  if (!data.user_id || typeof data.user_id !== 'string') {
    errors.push('User ID is required');
  }

  if (!data.role_id || typeof data.role_id !== 'string') {
    errors.push('Role ID is required');
  }

  if (!data.assigned_by || typeof data.assigned_by !== 'string') {
    errors.push('Assigned by user ID is required');
  }

  // Check for self-assignment
  if (data.user_id && data.assigned_by && data.user_id === data.assigned_by) {
    warnings.push('User is assigning themselves to a role');
  }

  const result: ValidationResult = {
    isValid: errors.length === 0,
    errors,
    warnings,
  };

  logger.debug('User role assignment validation result', { 
    action: 'validation', 
    function: 'validateUserRoleAssignment',
    isValid: result.isValid,
    errorCount: errors.length,
    warningCount: warnings.length
  });

  return result;
}

// Generic validation helpers
export function validateRequired(value: any, fieldName: string): string | null {
  if (value === null || value === undefined || value === '') {
    return `${fieldName} is required`;
  }
  return null;
}

export function validateString(value: any, fieldName: string, maxLength?: number): string | null {
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }
  
  if (value.trim().length === 0) {
    return `${fieldName} cannot be empty`;
  }
  
  if (maxLength && value.length > maxLength) {
    return `${fieldName} must be ${maxLength} characters or less`;
  }
  
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return 'Email is required';
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Email must be a valid email address';
  }
  
  if (email.length > 255) {
    return 'Email must be 255 characters or less';
  }
  
  return null;
}

export function validateUUID(uuid: string, fieldName: string): string | null {
  if (!uuid || typeof uuid !== 'string') {
    return `${fieldName} is required`;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    return `${fieldName} must be a valid UUID`;
  }
  
  return null;
}

export function validateArray(value: any, fieldName: string, itemValidator?: (item: any) => string | null): string | null {
  if (!Array.isArray(value)) {
    return `${fieldName} must be an array`;
  }
  
  if (itemValidator) {
    for (let i = 0; i < value.length; i++) {
      const error = itemValidator(value[i]);
      if (error) {
        return `${fieldName}[${i}]: ${error}`;
      }
    }
  }
  
  return null;
}

export function validateObject(value: any, fieldName: string, requiredFields: string[]): string | null {
  if (typeof value !== 'object' || value === null) {
    return `${fieldName} must be an object`;
  }
  
  for (const field of requiredFields) {
    if (!(field in value)) {
      return `${fieldName} is missing required field: ${field}`;
    }
  }
  
  return null;
}

// Form validation helpers
export function validateFormData<T extends Record<string, any>>(
  data: T,
  validators: Record<keyof T, (value: any) => string | null>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  logger.debug('Validating form data', { action: 'validation', function: 'validateFormData' });

  for (const [field, validator] of Object.entries(validators)) {
    const error = validator(data[field]);
    if (error) {
      errors.push(error);
    }
  }

  const result: ValidationResult = {
    isValid: errors.length === 0,
    errors,
    warnings,
  };

  logger.debug('Form validation result', { 
    action: 'validation', 
    function: 'validateFormData',
    isValid: result.isValid,
    errorCount: errors.length,
    fieldCount: Object.keys(validators).length
  });

  return result;
}

// Sanitization helpers
export function sanitizeString(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function sanitizeArray(array: string[]): string[] {
  return array
    .map(item => sanitizeString(item))
    .filter(item => item.length > 0);
}

// Export validation schemas for common use cases
export const RoleValidationSchema = {
  name: (value: any) => validateString(value, 'Role name', 100),
  description: (value: any) => value ? validateString(value, 'Description', 500) : null,
  department_id: (value: any) => validateUUID(value, 'Department ID'),
  reporting_role_id: (value: any) => value ? validateUUID(value, 'Reporting role ID') : null,
};

export const UserValidationSchema = {
  name: (value: any) => validateString(value, 'Name', 100),
  email: (value: any) => validateEmail(value),
  bio: (value: any) => value ? validateString(value, 'Bio', 1000) : null,
  skills: (value: any) => value ? validateArray(value, 'Skills', (item) => validateString(item, 'Skill', 50)) : null,
};

export const DepartmentValidationSchema = {
  name: (value: unknown) => validateString(value, 'Department name', 100),
  description: (value: unknown) => value ? validateString(value, 'Description', 500) : null,
};
