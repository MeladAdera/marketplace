// src/constants/permissions.ts
// Centralized role and permission definitions for RBAC system

// =============================================================================
// USER ROLES
// =============================================================================
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

  // ─────────────────────────────────────────────────────────────────────────
  // Platform Admin - Vendor Management (NEW)
  // ─────────────────────────────────────────────────────────────────────────
  PLATFORM_VENDOR_READ = 'platform:vendor:read',
  PLATFORM_VENDOR_UPDATE = 'platform:vendor:update',
  PLATFORM_VENDOR_SUSPEND = 'platform:vendor:suspend',
  PLATFORM_VENDOR_ACTIVATE = 'platform:vendor:activate',
  PLATFORM_VENDOR_DELETE = 'platform:vendor:delete',
}

// =============================================================================
// ROLE → PERMISSIONS MAPPING
// =============================================================================
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),

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

  [UserRole.VENDOR_STAFF]: [
    Permission.PROFILE_READ,
    Permission.PRODUCT_READ,
    Permission.INVENTORY_READ,
    Permission.ORDER_READ,
  ],

  [UserRole.SUPPORT]: [
    Permission.PROFILE_READ,
    Permission.PRODUCT_READ,
    Permission.ORDER_READ,
    Permission.ORDER_REFUND,
  ],

  [UserRole.PLATFORM_ADMIN]: Object.values(Permission), // ✅ Auto-includes new permissions

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
  ],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}