// src/errors/index.ts

import { AppError } from './AppError';

// Export base class
export { AppError } from './AppError';

// Export authentication errors
export * from './auth.errors';

// Export vendor errors
export * from './vendor.errors';

// Export product errors
export * from './product.errors';

// Export database errors
export * from './database.errors';

/**
 * Helper functions to check error type
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isOperationalError(error: unknown): boolean {
  return isAppError(error) && error.isOperational;
}