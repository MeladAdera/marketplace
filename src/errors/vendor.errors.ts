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
      { slug },
      'vendor.slug_exists',  
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
      organizationId ? { organizationId } : undefined,
      'vendor.organization_not_found',  
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
      'NO_ORGANIZATION',
      true,
      undefined,
      'vendor.no_organization'  
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
      'ADMIN_NOT_FOUND',
      true,
      undefined,
      'vendor.admin_not_found'  
    );
  }
}

/**
 * Error: User already exists in this organization
 */
export class UserAlreadyInOrganizationError extends AppError {
  constructor(email?: string) {  // ✅ email اختياري
    super(
      email 
        ? `User ${email} already exists in this organization`
        : 'User already exists in this organization',
      409,
      'USER_ALREADY_IN_ORGANIZATION',
      true,
      email ? { email } : undefined,
      'vendor.user_already_in_org',
      email ? { email } : undefined
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
      { email },
      'vendor.email_already_registered',  
      { email }
    );
  }
}

/**
 * Error: Vendor registration failed
 */
export class VendorRegistrationError extends AppError {
  constructor(details?: Record<string, any>) {
    super(
      'Failed to register vendor',
      500,
      'VENDOR_REGISTRATION_FAILED',
      true,
      details,
      'vendor.registration_failed'  
    );
  }
}

/**
 * Error: Vendor profile update failed
 */
export class VendorUpdateError extends AppError {
  constructor(details?: Record<string, any>) {
    super(
      'Failed to update vendor profile',
      500,
      'VENDOR_UPDATE_FAILED',
      true,
      details,
      'vendor.update_failed'  
    );
  }
}

/**
 * Error: Staff invite failed
 */
export class StaffInviteError extends AppError {
  constructor(details?: Record<string, any>) {
    super(
      'Failed to invite staff member',
      500,
      'STAFF_INVITE_FAILED',
      true,
      details,
      'vendor.invite_failed'  
    );
  }
}



// ✅ ADD THESE 4 NEW CLASSES AT THE END:

/**
 * Error: Invitation already exists
 */
export class InvitationAlreadyExistsError extends AppError {
  constructor(email: string) {
    super(
      `A pending invitation already exists for ${email}`,
      409,
      'INVITATION_ALREADY_EXISTS',
      true,
      { email },
      'vendor.invitation_already_exists',
      { email }
    );
  }
}

/**
 * Error: Invitation not found
 */
export class InvitationNotFoundError extends AppError {
  constructor() {
    super(
      'Invitation not found or has been revoked',
      404,
      'INVITATION_NOT_FOUND',
      true,
      undefined,
      'vendor.invitation_not_found'
    );
  }
}

/**
 * Error: Invitation expired
 */
export class InvitationExpiredError extends AppError {
  constructor() {
    super(
      'This invitation has expired',
      400,
      'INVITATION_EXPIRED',
      true,
      undefined,
      'vendor.invitation_expired'
    );
  }
}

/**
 * Error: Invitation already accepted
 */
export class InvitationAlreadyAcceptedError extends AppError {
  constructor() {
    super(
      'This invitation has already been accepted',
      400,
      'INVITATION_ALREADY_ACCEPTED',
      true,
      undefined,
      'vendor.invitation_already_accepted'
    );
  }
}
// =============================================================================
// PLATFORM ADMIN - VENDOR MANAGEMENT ERRORS
// =============================================================================

/**
 * Error: Vendor/Organization not found (alias for consistency)
 */
export class VendorNotFoundError extends AppError {
  constructor(vendorId?: string) {
    super(
      vendorId 
        ? `Vendor with ID ${vendorId} not found`
        : 'Vendor not found',
      404,                    // statusCode
      'VENDOR_NOT_FOUND',     // ✅ errorCode (نمرره هنا مباشرة)
      true,                   // isOperational
      vendorId ? { vendorId } : undefined, // details
      'vendor.not_found',     // ✅ translationKey (نمرره هنا مباشرة)
      vendorId ? { vendorId } : undefined  // translationParams
    );
  }
}

/**
 * Error: Vendor is already suspended
 */
export class VendorSuspendedError extends AppError {
  constructor(organizationId: string) {
    super(
      `Vendor is currently suspended`,
      400,
      'VENDOR_ALREADY_SUSPENDED',
      true,
      { organizationId },
      'vendor.already_suspended',
      { organizationId }
    );
  }
}

/**
 * Error: Vendor is not suspended (cannot activate)
 */
export class VendorAlreadyActiveError extends AppError {
  constructor(organizationId: string) {
    super(
      `Vendor is not suspended, cannot activate`,
      400,
      'VENDOR_ALREADY_ACTIVE',
      true,
      { organizationId },
      'vendor.already_active',
      { organizationId }
    );
  }
}

/**
 * Error: Vendor cannot be deleted (has active data)
 */
export class VendorDeleteProtectedError extends AppError {
  constructor(reason: string, details?: Record<string, any>) {
    super(
      `Cannot delete vendor: ${reason}`,
      409,
      'VENDOR_DELETE_PROTECTED',
      true,
      { reason, ...details },
      'vendor.delete_protected',
      { reason }
    );
  }
}