// src/errors/vendor.errors.ts

import { AppError } from './AppError';

/**
 * Error: Company slug already exists
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
 * Error: Organization not found
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
 * Error: User does not belong to any organization
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
 * Error: Admin not found
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
 * Error: User already exists in this organization
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
 * Error: Email already registered in another organization
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