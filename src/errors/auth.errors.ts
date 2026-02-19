// ==========================================
// src/errors/auth.errors.ts
// ==========================================

import { AppError } from './AppError';

/**
 * خطأ: البريد الإلكتروني أو كلمة المرور غير صحيحة
 */
export class InvalidCredentialsError extends AppError {
  constructor() {
    super(
      'Invalid email or password',  // رسالة للمستخدم
      401,                          // Unauthorized
      'INVALID_CREDENTIALS'         // كود داخلي
    );
  }
}

/**
 * خطأ: الحساب معطل
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
 * خطأ: البريد الإلكتروني موجود مسبقاً
 */
export class EmailAlreadyExistsError extends AppError {
  constructor() {
    super(
      'Email already exists',
      409,                          // Conflict
      'EMAIL_ALREADY_EXISTS'
    );
  }
}

/**
 * خطأ: دور المستخدم غير صحيح
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
 * خطأ: الجلسة غير موجودة
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
 * خطأ: الجلسة ملغية
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
 * خطأ: الجلسة منتهية الصلاحية
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
 * خطأ: المستخدم غير مصادق عليه
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
 * خطأ: صلاحيات غير كافية
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