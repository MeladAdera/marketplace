// src/errors/auth.errors.ts
import { AppError } from './AppError';

export class InvalidCredentialsError extends AppError {
  constructor() {
    super(
      'Invalid email or password',
      401,
      'INVALID_CREDENTIALS',
      true,
      undefined,
      'auth.invalid_credentials',  
    );
  }
}

export class UserDisabledError extends AppError {
  constructor() {
    super(
      'User account is disabled',
      403,
      'USER_DISABLED',
      true,
      undefined,
      'auth.user_disabled',
    );
  }
}

export class EmailAlreadyExistsError extends AppError {
  constructor() {
    super(
      'Email already exists',
      409,
      'EMAIL_ALREADY_EXISTS',
      true,
      undefined,
      'auth.email_exists',
    );
  }
}

export class InvalidRoleError extends AppError {
  constructor(role?: string) {
    super(
      `Invalid user role${role ? `: ${role}` : ''}`,
      400,
      'INVALID_ROLE',
      true,
      undefined,
      'auth.invalid_role',
      { role }  // ✅ متغير للترجمة
    );
  }
}

export class SessionNotFoundError extends AppError {
  constructor() {
    super(
      'Session not found',
      401,
      'SESSION_NOT_FOUND',
      true,
      undefined,
      'auth.session_not_found',
    );
  }
}

export class SessionRevokedError extends AppError {
  constructor() {
    super(
      'Session revoked',
      401,
      'SESSION_REVOKED',
      true,
      undefined,
      'auth.session_revoked',
    );
  }
}

export class SessionExpiredError extends AppError {
  constructor() {
    super(
      'Session expired',
      401,
      'SESSION_EXPIRED',
      true,
      undefined,
      'auth.session_expired',
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Not authenticated') {
    super(
      message,
      401,
      'UNAUTHORIZED',
      true,
      undefined,
      'auth.unauthorized',
    );
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(
      message,
      403,
      'FORBIDDEN',
      true,
      undefined,
      'auth.forbidden',
    );
  }
}