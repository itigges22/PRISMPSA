import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Error handling utilities for catch blocks with unknown type
export interface AppError {
  message: string;
  name?: string;
  status?: number;
  stack?: string;
}

export function getErrorMessage(error: any): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unknown error occurred';
}

export function getErrorDetails(error: any): AppError {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    return {
      message: typeof err.message === 'string' ? err.message : 'Unknown error',
      name: typeof err.name === 'string' ? err.name : undefined,
      status: typeof err.status === 'number' ? err.status : undefined,
      stack: typeof err.stack === 'string' ? err.stack : undefined,
    };
  }
  return { message: String(error) };
}
