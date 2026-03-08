// src/services/authorization.service.ts
// Centralized service for permission validation and policy enforcement
// Provides reusable, testable authorization logic decoupled from HTTP layer

import { UserRole, Permission, ROLE_PERMISSIONS, hasPermission } from '../constants/permissions';
import { ForbiddenError } from '../errors/AppError';

export class AuthorizationService {
  
  /**
   * Checks if a given role possesses a specific permission.
   * 
   * @param role - The user's role to evaluate
   * @param permission - The permission to check against
   * @returns true if the role is granted the permission, false otherwise
   */
  static hasPermission(role: UserRole, permission: Permission): boolean {
    return hasPermission(role, permission);
  }

  /**
   * Checks if a given role possesses a set of permissions.
   * 
   * @param role - The user's role to evaluate
   * @param permissions - Array of permissions to validate
   * @param requireAll - If true, role must have ALL permissions; if false, ANY suffices
   * @returns true if permission requirements are satisfied
   */
  static hasPermissions(
    role: UserRole,
    permissions: Permission[],
    requireAll: boolean = false
  ): boolean {
    if (requireAll) {
      return permissions.every(p => hasPermission(role, p));
    }
    return permissions.some(p => hasPermission(role, p));
  }

  /**
   * Enforces resource ownership policy.
   * 
   * Verifies that a resource belongs to the user's organization,
   * preventing cross-organization data access (multi-tenancy isolation).
   * 
   * @param userOrganizationId - The organization ID of the authenticated user
   * @param resource - Any entity with an organization_id field to validate
   * @throws ForbiddenError if resource does not belong to user's organization
   * 
   * @example
   * ```ts
   * AuthorizationService.assertOwnership(req.user.organization_id, product);
   * ```
   */
  static assertOwnership<T extends { organization_id: string | null }>(
    userOrganizationId: string,
    resource: T
  ): void {
    if (resource.organization_id !== userOrganizationId) {
      throw new ForbiddenError("You can only access resources within your organization");
    }
  }

  /**
   * Convenience method to throw a standardized authorization error.
   * 
   * @param message - Optional custom error message
   * @throws ForbiddenError with the provided or default message
   * 
   * @example
   * ```ts
   * if (!isValid) AuthorizationService.deny("Custom policy violation");
   * ```
   */
  static deny(message?: string): never {
    throw new ForbiddenError(message ?? "Access denied");
  }
}