// ==========================================
// src/errors/vendor.errors.ts
// ==========================================

import { AppError } from './AppError';

/**
 * خطأ: اسم الشركة (slug) موجود مسبقاً
 */
export class SlugAlreadyExistsError extends AppError {
  constructor(slug: string) {
    super(
      `Company slug "${slug}" already taken`,
      409,
      'SLUG_ALREADY_EXISTS',
      true,
      { slug }
    );
  }
}

/**
 * خطأ: المنشأة (الشركة) غير موجودة
 */
export class OrganizationNotFoundError extends AppError {
  constructor(organizationId?: string | number) {
    super(
      organizationId 
        ? `Organization with ID ${organizationId} not found`
        : 'Organization not found',
      404,
      'ORGANIZATION_NOT_FOUND',
      true,
      organizationId ? { organizationId } : undefined
    );
  }
}

/**
 * خطأ: المستخدم لا ينتمي لأي منشأة
 */
export class NoOrganizationError extends AppError {
  constructor() {
    super(
      'User does not belong to any organization',
      404,
      'NO_ORGANIZATION'
    );
  }
}

/**
 * خطأ: مدير الشركة غير موجود
 */
export class AdminNotFoundError extends AppError {
  constructor() {
    super(
      'Admin not found',
      404,
      'ADMIN_NOT_FOUND'
    );
  }
}

/**
 * خطأ: المستخدم موجود بالفعل في هذه المنشأة
 */
export class UserAlreadyInOrganizationError extends AppError {
  constructor(email: string) {
    super(
      `User ${email} already exists in this organization`,
      409,
      'USER_ALREADY_IN_ORGANIZATION',
      true,
      { email }
    );
  }
}

/**
 * خطأ: البريد الإلكتروني مسجل في منشأة أخرى
 */
export class EmailAlreadyRegisteredError extends AppError {
  constructor(email: string) {
    super(
      `Email ${email} already registered in another organization`,
      409,
      'EMAIL_ALREADY_REGISTERED',
      true,
      { email }
    );
  }
}