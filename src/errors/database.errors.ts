
// ==========================================
// src/errors/database.errors.ts
// ==========================================

import { AppError } from './AppError';

/**
 * Database connection failed
 */
export class DatabaseConnectionError extends AppError {
  constructor(originalError?: Error) {
    super(
      'Database connection failed',
      503,
      'DATABASE_CONNECTION_ERROR',
      false,
      originalError ? { originalMessage: originalError.message } : undefined
    );
  }
}

/**
 * Error: Violation of unique constraint (e.g., duplicate email)
 */
export class UniqueConstraintViolationError extends AppError {
  constructor(field: string, value: string) {
    super(
      `Duplicate value for ${field}: ${value}`,
      409,
      'UNIQUE_CONSTRAINT_VIOLATION',
      true,
      { field, value }
    );
  }
}

/**
 * foreign key constraint
 */
export class ForeignKeyViolationError extends AppError {
  constructor(message: string) {
    super(
      message,
      400,
      'FOREIGN_KEY_VIOLATION',
      true
    );
  }
}

/**
 * Error: Transaction failed
 */
export class TransactionError extends AppError {
  constructor(message: string = 'Transaction failed', originalError?: Error) {
    super(
      message,
      500,
      'TRANSACTION_ERROR',
      false,
      originalError ? { originalMessage: originalError.message } : undefined
    );
  }
}

/**
* Error: Database query error */
export class QueryError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(
      message,
      500,
      'QUERY_ERROR',
      false,
      originalError ? { originalMessage: originalError.message } : undefined
    );
  }
}