// src/constants/permissions.ts
// Centralized role and permission definitions for RBAC system

// =============================================================================
// USER ROLES
// =============================================================================
// Defines all possible user roles in the system.
// Using enum ensures type safety and prevents typos.

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  VENDOR_ADMIN = 'vendor_admin',
  VENDOR_STAFF = 'vendor_staff',
  SUPPORT = 'support',
  PLATFORM_ADMIN = 'platform_admin',
  CUSTOMER = 'customer'
}

// =============================================================================
// PERMISSIONS
// =============================================================================
// Granular permissions that represent specific actions.
// Format: 'resource:action' (e.g., 'product:create')
// This approach enables fine-grained access control beyond simple role checks.

export enum Permission {
  // ─────────────────────────────────────────────────────────────────────────
  // User Profile Management
  // ─────────────────────────────────────────────────────────────────────────
  PROFILE_READ = 'profile:read',
  PROFILE_UPDATE = 'profile:update',

  // ─────────────────────────────────────────────────────────────────────────
  // Product Management
  // ─────────────────────────────────────────────────────────────────────────
  PRODUCT_CREATE = 'product:create',
  PRODUCT_READ = 'product:read',
  PRODUCT_UPDATE = 'product:update',
  PRODUCT_DELETE = 'product:delete',

  // ─────────────────────────────────────────────────────────────────────────
  // Inventory Management
  // ─────────────────────────────────────────────────────────────────────────
  INVENTORY_READ = 'inventory:read',
  INVENTORY_UPDATE = 'inventory:update',

  // ─────────────────────────────────────────────────────────────────────────
  // Staff / Team Management (Vendor-specific)
  // ─────────────────────────────────────────────────────────────────────────
  STAFF_INVITE = 'staff:invite',
  STAFF_READ = 'staff:read',
  STAFF_REVOKE = 'staff:revoke',

  // ─────────────────────────────────────────────────────────────────────────
  // Order Management
  // ─────────────────────────────────────────────────────────────────────────
  ORDER_CREATE = 'order:create',
  ORDER_READ = 'order:read',
  ORDER_UPDATE = 'order:update',
  ORDER_REFUND = 'order:refund',

  // ─────────────────────────────────────────────────────────────────────────
  // Shopping Cart Management
  // ─────────────────────────────────────────────────────────────────────────
  CART_READ = 'cart:read',
  CART_CREATE = 'cart:create',
  CART_UPDATE = 'cart:update',
  CART_DELETE = 'cart:delete',
  // ─────────────────────────────────────────────────────────────────────────
// Vendor Analytics / Statistics
// ─────────────────────────────────────────────────────────────────────────
VENDOR_STATS_READ = 'vendor:stats:read',
}


// =============================================================================
// ROLE → PERMISSIONS MAPPING
// =============================================================================
// Defines which permissions each role possesses.
// Centralized management: modify permissions in one place, affects all routes.
// Follows principle of least privilege: roles only get what they need.

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // ─────────────────────────────────────────────────────────────────────────
  // SUPER_ADMIN: Full platform access (use with caution)
  // ─────────────────────────────────────────────────────────────────────────
  [UserRole.SUPER_ADMIN]: Object.values(Permission),

  // ─────────────────────────────────────────────────────────────────────────
  // VENDOR_ADMIN: Full access to vendor-specific resources
  // ─────────────────────────────────────────────────────────────────────────
  [UserRole.VENDOR_ADMIN]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_READ,
    Permission.PRODUCT_UPDATE,
    Permission.PRODUCT_DELETE,
    Permission.INVENTORY_READ,
    Permission.INVENTORY_UPDATE,
    Permission.STAFF_INVITE,
    Permission.STAFF_READ,
    Permission.STAFF_REVOKE,
    Permission.ORDER_READ,
    Permission.ORDER_UPDATE,
     Permission.VENDOR_STATS_READ,
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // VENDOR_STAFF: Read-only access to vendor resources (no destructive actions)
  // ─────────────────────────────────────────────────────────────────────────
  [UserRole.VENDOR_STAFF]: [
    Permission.PROFILE_READ,
    Permission.PRODUCT_READ,
    Permission.INVENTORY_READ,
    Permission.ORDER_READ,
    // Explicitly excluded: PRODUCT_*, INVENTORY_UPDATE, STAFF_*, ORDER_UPDATE
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // SUPPORT: Read access for customer assistance, limited write for refunds
  // ─────────────────────────────────────────────────────────────────────────
  [UserRole.SUPPORT]: [
    Permission.PROFILE_READ,
    Permission.PRODUCT_READ,
    Permission.ORDER_READ,
    Permission.ORDER_REFUND,
    // Explicitly excluded: PRODUCT_*, INVENTORY_*, STAFF_*, CART_*
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // PLATFORM_ADMIN: Full access (same as SUPER_ADMIN, semantic difference only)
  // ─────────────────────────────────────────────────────────────────────────
  [UserRole.PLATFORM_ADMIN]: Object.values(Permission),

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOMER: Minimal permissions for end-user actions
  // ─────────────────────────────────────────────────────────────────────────
  [UserRole.CUSTOMER]: [
    Permission.PROFILE_READ,
    Permission.PROFILE_UPDATE,
    Permission.ORDER_CREATE,
    Permission.ORDER_READ,
    Permission.ORDER_UPDATE,
    Permission.CART_READ,
    Permission.CART_CREATE,
    Permission.CART_UPDATE,
    Permission.CART_DELETE,
    // Explicitly excluded: PRODUCT_*, INVENTORY_*, STAFF_*, ORDER_REFUND
  ],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
// Utility functions for permission checks.
// These can be used directly or via AuthorizationService for consistency.

/**
 * Checks if a given role has a specific permission.
 * @param role - The user's role
 * @param permission - The permission to check
 * @returns true if the role has the permission, false otherwise
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Checks if a given role has ALL of the specified permissions.
 * @param role - The user's role
 * @param permissions - Array of permissions to check
 * @returns true only if the role has every permission in the array
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

/**
 * Checks if a given role has ANY of the specified permissions.
 * @param role - The user's role
 * @param permissions - Array of permissions to check
 * @returns true if the role has at least one permission in the array
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}