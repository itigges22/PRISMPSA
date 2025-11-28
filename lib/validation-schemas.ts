/**
 * Zod Validation Schemas for API Routes
 * Centralizes all input validation with type-safe schemas
 */

import { z } from 'zod';

// ============================================================================
// COMMON/REUSABLE SCHEMAS
// ============================================================================

export const uuidSchema = z.string().uuid('Invalid UUID format');
export const emailSchema = z.string().email('Invalid email format');
export const dateSchema = z.string().datetime('Invalid datetime format');
export const positiveNumberSchema = z.number().positive('Must be a positive number');
export const nonNegativeNumberSchema = z.number().nonnegative('Must be non-negative');

// ============================================================================
// PROJECT SCHEMAS
// ============================================================================

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200, 'Project name too long'),
  description: z.string().max(2000, 'Description too long').optional().nullable(),
  accountId: uuidSchema,
  status: z.enum(['planning', 'in-progress', 'on-hold', 'completed', 'cancelled']).optional(),
  start_date: dateSchema.optional().nullable(),
  end_date: dateSchema.optional().nullable(),
  budget: positiveNumberSchema.optional().nullable(),
  assigned_user_id: uuidSchema.optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['planning', 'in-progress', 'on-hold', 'completed', 'cancelled']).optional(),
  start_date: dateSchema.optional().nullable(),
  end_date: dateSchema.optional().nullable(),
  budget: positiveNumberSchema.optional().nullable(),
  assigned_user_id: uuidSchema.optional().nullable(),
});

export const getProjectsQuerySchema = z.object({
  userId: uuidSchema,
  limit: z.string().regex(/^\d+$/, 'Limit must be a number').transform(Number).optional(),
});

// ============================================================================
// ACCOUNT SCHEMAS
// ============================================================================

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required').max(200, 'Account name too long'),
  description: z.string().max(2000, 'Description too long').optional().nullable(),
  primary_contact_name: z.string().max(200, 'Contact name too long').optional().nullable(),
  primary_contact_email: emailSchema.optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  account_manager_id: uuidSchema.optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  primary_contact_name: z.string().max(200).optional().nullable(),
  primary_contact_email: emailSchema.optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  account_manager_id: uuidSchema.optional().nullable(),
});

// ============================================================================
// TASK SCHEMAS
// ============================================================================

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(200, 'Title too long'),
  description: z.string().max(5000, 'Description too long').optional().nullable(),
  project_id: uuidSchema,
  assigned_to: uuidSchema.optional().nullable(),
  estimated_hours: positiveNumberSchema.optional().nullable(),
  remaining_hours: nonNegativeNumberSchema.optional().nullable(),
  due_date: dateSchema.optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done', 'blocked']).optional(),
  dependencies: z.array(uuidSchema).optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

// ============================================================================
// TIME ENTRY SCHEMAS
// ============================================================================

export const createTimeEntrySchema = z.object({
  taskId: uuidSchema,
  projectId: uuidSchema,
  hoursLogged: z.number().min(0.1, 'Hours must be at least 0.1').max(24, 'Hours cannot exceed 24'),
  entryDate: dateSchema,
  description: z.string().max(1000, 'Description too long').optional().nullable(),
  notes: z.string().max(2000, 'Notes too long').optional().nullable(),
});

export const updateTimeEntrySchema = z.object({
  hoursLogged: z.number().min(0.1).max(24).optional(),
  description: z.string().max(1000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const getTimeEntriesQuerySchema = z.object({
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  userId: uuidSchema.optional(),
  projectId: uuidSchema.optional(),
  taskId: uuidSchema.optional(),
});

// ============================================================================
// ROLE SCHEMAS
// ============================================================================

export const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100, 'Role name too long'),
  description: z.string().max(500, 'Description too long').optional().nullable(),
  department_id: uuidSchema,
  hierarchy_level: z.number().int().min(1).max(10).optional(),
  reporting_role_id: uuidSchema.optional().nullable(),
  permissions: z.record(z.string(), z.boolean()).optional(),
});

export const updateRoleSchema = createRoleSchema.partial();

// ============================================================================
// USER PROFILE SCHEMAS
// ============================================================================

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: emailSchema.optional(),
  phone: z.string().max(50).optional().nullable(),
  bio: z.string().max(1000).optional().nullable(),
});

// ============================================================================
// AVAILABILITY SCHEMAS
// ============================================================================

export const createAvailabilitySchema = z.object({
  week_start_date: dateSchema,
  available_hours: z.number().min(0, 'Hours must be non-negative').max(168, 'Cannot exceed 168 hours per week'),
});

export const updateAvailabilitySchema = z.object({
  available_hours: z.number().min(0).max(168),
});

// ============================================================================
// DEPARTMENT SCHEMAS
// ============================================================================

export const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional().nullable(),
  parent_department_id: uuidSchema.optional().nullable(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

// ============================================================================
// PROJECT UPDATE SCHEMAS
// ============================================================================

export const createProjectUpdateSchema = z.object({
  project_id: uuidSchema,
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000, 'Content too long'),
  update_type: z.enum(['status', 'milestone', 'issue', 'general']).optional(),
});

export const updateProjectUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
  update_type: z.enum(['status', 'milestone', 'issue', 'general']).optional(),
});

// ============================================================================
// ISSUE SCHEMAS
// ============================================================================

export const createIssueSchema = z.object({
  project_id: uuidSchema,
  title: z.string().min(1, 'Issue title is required').max(200, 'Title too long'),
  description: z.string().max(5000, 'Description too long').optional().nullable(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
});

export const updateIssueSchema = createIssueSchema.partial().omit({ project_id: true });

// ============================================================================
// CAPACITY SCHEMAS
// ============================================================================

export const getCapacityQuerySchema = z.object({
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  departmentId: uuidSchema.optional(),
  accountId: uuidSchema.optional(),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Safely parse request body with Zod schema
 * Returns { success: true, data } or { success: false, error }
 */
export function validateRequestBody<T>(schema: z.ZodSchema<T>, body: unknown) {
  try {
    const data = schema.parse(body);
    return { success: true as const, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return {
        success: false as const,
        error: `${firstError.path.join('.')}: ${firstError.message}`,
        zodError: error,
      };
    }
    return {
      success: false as const,
      error: 'Invalid request body',
    };
  }
}

/**
 * Safely parse query parameters with Zod schema
 */
export function validateQueryParams<T>(schema: z.ZodSchema<T>, params: Record<string, string | string[]>) {
  try {
    // Convert single values from arrays if needed
    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(params)) {
      normalized[key] = Array.isArray(value) ? value[0] : value;
    }
    const data = schema.parse(normalized);
    return { success: true as const, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return {
        success: false as const,
        error: `${firstError.path.join('.')}: ${firstError.message}`,
        zodError: error,
      };
    }
    return {
      success: false as const,
      error: 'Invalid query parameters',
    };
  }
}

// Export type inference helpers
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type CreateProjectUpdateInput = z.infer<typeof createProjectUpdateSchema>;
export type CreateIssueInput = z.infer<typeof createIssueSchema>;
