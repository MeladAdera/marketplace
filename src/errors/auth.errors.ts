// src/errors/auth.errors.ts

import { AppError } from './AppError';

/**
 * Error: Incorrect email or password
 */
export class InvalidCredentialsError extends AppError {
  constructor() {
    super(
      'Invalid email or password',  
      401,                          
      'INVALID_CREDENTIALS'         
    );
  }
}

/**
 * User account is disabled
 */
export class UserDisabledError extends AppError {
  constructor() {
    super(
      'User account is disabled',
      403,
      'USER_DISABLED'
    );
  }
}

/**
 *Email already exists
 */
export class EmailAlreadyExistsError extends AppError {
  constructor() {
    super(
      'Email already exists',
      409,                          
      'EMAIL_ALREADY_EXISTS'
    );
  }
}

/**
 * INVALID_ROLE
 */
export class InvalidRoleError extends AppError {
  constructor(role?: string) {
    super(
      `Invalid user role${role ? `: ${role}` : ''}`,
      400,
      'INVALID_ROLE'
    );
  }
}

/**
 * Session not found
 */
export class SessionNotFoundError extends AppError {
  constructor() {
    super(
      'Session not found',
      401,
      'SESSION_NOT_FOUND'
    );
  }
}

/**
 *Session revoked
 */
export class SessionRevokedError extends AppError {
  constructor() {
    super(
      'Session revoked',
      401,
      'SESSION_REVOKED'
    );
  }
}

/**
 *Session expired
 */
export class SessionExpiredError extends AppError {
  constructor() {
    super(
      'Session expired',
      401,
      'SESSION_EXPIRED'
    );
  }
}

/**
 * user UNAUTHORIZED
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Not authenticated') {
    super(
      message,
      401,
      'UNAUTHORIZED'
    );
  }
}

/**
 * Error: Insufficient permissions
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(
      message,
      403,
      'FORBIDDEN'
    );
  }
}