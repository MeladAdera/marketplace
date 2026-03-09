// src/services/platform-admin.service.ts
// Platform Admin - Vendor Management Service Layer
// ✅ Business logic + Transactions + Audit + Safety Checks

import pool from "../db/database";
import { PoolClient } from "pg";

// Repository imports
import {
  // Organization queries (from platform-admin repo)
  listOrganizationsAdmin,
  findOrganizationWithStats,
  softDeleteOrganization,
  canSoftDeleteOrganization,
  restoreOrganization,
} from "../repository/platform-admin.repo";

// User queries (from users repo - updated to support client)
import {
  findUsersByOrganization,
  blockUsersByOrganization,
  unblockUsersByOrganization,
} from "../repository/users.repo";

// Organization update (from organization repo - must support client)
import { updateOrganization } from "../repository/organization.repo";

// Audit logging
import { createAuditLog } from "../repository/audit.repo";

// Types
import {
  AdminVendorFilters,
  SuspendVendorInput,
  ActivateVendorInput,
} from "../types/organization.types";

// Errors
import {
  OrganizationNotFoundError as VendorNotFoundError,
  VendorSuspendedError,
  VendorAlreadyActiveError,
  VendorDeleteProtectedError,
} from "../errors/vendor.errors";

// =============================================================================
// CONSTANTS
// =============================================================================

// ✅ تعريف الأدوار في مكان واحد لتجنب التكرار والأخطاء
export const VENDOR_MANAGEMENT_ROLES = ['vendor_admin', 'vendor_staff'] as const;
export type VendorManagementRole = typeof VENDOR_MANAGEMENT_ROLES[number];

// =============================================================================
// 🔍 QUERIES (Read-only operations)
// =============================================================================

/**
 * Query: List vendors for admin dashboard
 * 
 * 🎯 Purpose: Display paginated, filtered list of vendors
 * 🔐 Security: No data modification, safe to call from any authorized context
 * ⚡ Performance: Uses subqueries for stats (optimized for <10k vendors)
 */
export async function listVendorsQuery(filters: AdminVendorFilters) {
  const result = await listOrganizationsAdmin(filters);

  // Transform for API response (hide internal fields, format numbers)
  return {
    vendors: result.organizations.map((org: any) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      deleted_at: org.deleted_at,
      created_at: org.created_at,
      stats: {
        // ✅ Convert string counts from SQL to numbers, with fallback
        product_count: parseInt(org.product_count, 10) || 0,
        user_count: parseInt(org.user_count, 10) || 0,
      },
    })),
    pagination: result.pagination,
  };
}

/**
 * Query: Get detailed vendor information
 * 
 * 🎯 Purpose: Show full vendor profile + staff list + stats for investigation
 * 🔐 Security: Returns sensitive data (staff emails) → ensure caller is authorized
 */
export async function getVendorDetailsQuery(organizationId: string) {
  // 1. Get organization with stats
  const organization = await findOrganizationWithStats(organizationId);

  if (!organization) {
    throw new VendorNotFoundError(organizationId);
  }

  // 2. Get staff list (limited to 50 for performance)
  const staff = await findUsersByOrganization(organizationId, {
    limit: 50,
  });

  // 3. Format response
  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      deleted_at: organization.deleted_at,
      created_at: organization.created_at,
      updated_at: organization.updated_at,
    },
    stats: {
      total_products: parseInt(organization.total_products, 10) || 0,
      active_products: parseInt(organization.active_products, 10) || 0,
      admin_count: parseInt(organization.admin_count, 10) || 0,
      staff_count: parseInt(organization.staff_count, 10) || 0,
      blocked_users_count: parseInt(organization.blocked_users_count, 10) || 0,
    },
    staff: staff.map((user: any) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      blocked: user.blocked,
      blocked_at: user.blocked_at,
      created_at: user.created_at,
    })),
  };
}

// =============================================================================
// ⚡ COMMANDS (Write operations with transactions)
// =============================================================================

/**
 * Command: Update vendor organization details
 * 
 * 🎯 Purpose: Allow platform admin to correct vendor info (name, slug)
 * 🔐 Security: Requires PLATFORM_VENDOR_UPDATE permission + audit logging
 * ⚠️ Risk: Changing slug affects public URLs → validate uniqueness first
 */
export async function updateVendorCommand(
  organizationId: string,
  input: { name?: string; slug?: string },
  actorUserId: string
) {
  // 🔄 Start transaction for atomicity
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Validate: Get current state (within transaction)
    const currentOrg = await findOrganizationWithStats(organizationId, client);
    if (!currentOrg) {
      throw new VendorNotFoundError(organizationId);
    }

    // 2️⃣ Optional: If updating slug, check uniqueness
    if (input.slug && input.slug !== currentOrg.slug) {
      const { findOrganizationBySlug } = await import("../repository/organization.repo");
      const existing = await findOrganizationBySlug(input.slug, client);
      
      if (existing && existing.id !== organizationId) {
        throw new Error(`Slug "${input.slug}" is already taken`);
      }
    }

    // 3️⃣ Execute: Update organization (within transaction)
    const updatedOrg = await updateOrganization(
      organizationId,
      { name: input.name, slug: input.slug },
      client // ✅ Pass client for transaction safety
    );

    if (!updatedOrg) {
      throw new Error("UPDATE_FAILED");
    }

    // 4️⃣ Audit: Log the change (within transaction)
    await createAuditLog(
      {
        actorUserId,
        organizationId,
        action: "VENDOR_UPDATED_BY_ADMIN",
        entityType: "organization",
        entityId: organizationId,
        oldValues: {
          name: currentOrg.name,
          slug: currentOrg.slug,
        },
        newValues: {
          name: updatedOrg.name,
          slug: updatedOrg.slug,
        },
        metadata: {
          updated_by: "platform_admin",
          ip_address: null,
        },
      },
      client
    );

    // ✅ Commit transaction
    await client.query("COMMIT");

    // 5️⃣ Return clean response
    return {
      id: updatedOrg.id,
      name: updatedOrg.name,
      slug: updatedOrg.slug,
      status: updatedOrg.status,
      updated_at: updatedOrg.updated_at,
    };

  } catch (error) {
    // ❌ Rollback on any error
    await client.query("ROLLBACK");
    throw error;
  } finally {
    // 🧹 Always release the client back to the pool
    client.release();
  }
}

/**
 * Command: Suspend vendor (block login access)
 * 
 * 🎯 Purpose: Emergency action to stop vendor from accessing platform
 * 🔐 Security: Requires PLATFORM_VENDOR_SUSPEND + reason for audit trail
 * ⚠️ Risk: Blocks real users → log everything, allow temporary duration
 */
export async function suspendVendorCommand(
  organizationId: string,
  input: SuspendVendorInput,
  actorUserId: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Validate: Organization exists and is eligible for suspension
    const currentOrg = await findOrganizationWithStats(organizationId, client);
    
    if (!currentOrg) {
      throw new VendorNotFoundError(organizationId);
    }

    if (currentOrg.deleted_at) {
      throw new VendorDeleteProtectedError("Cannot suspend a deleted vendor");
    }

    if (currentOrg.status === "suspended") {
      throw new VendorSuspendedError(organizationId);
    }

    // 2️⃣ Execute: Block vendor users (vendor_admin + vendor_staff only)
    const blockedCount = await blockUsersByOrganization(
      organizationId,
      actorUserId,
      {
        roles: [...VENDOR_MANAGEMENT_ROLES],
        reason: input.reason,
      },
      client // ✅ Within transaction
    );

    // 3️⃣ Execute: Update organization status
    const updatedOrg = await updateOrganization(
      organizationId,
      { status: "suspended" },
      client // ✅ Within transaction
    );

    // 4️⃣ Audit: Log suspension details
    await createAuditLog(
      {
        actorUserId,
        organizationId,
        action: "VENDOR_SUSPENDED",
        entityType: "organization",
        entityId: organizationId,
        oldValues: {
          status: currentOrg.status,
          blocked_users_count: currentOrg.blocked_users_count,
        },
        newValues: {
          status: "suspended",
          blocked_users_count: blockedCount,
          suspension_reason: input.reason,
          suspension_duration_hours: input.duration_hours || null,
        },
        metadata: {
          reason: input.reason,
          duration_hours: input.duration_hours,
          blocked_user_count: blockedCount,
          suspended_by: "platform_admin",
        },
      },
      client
    );

    await client.query("COMMIT");

    return {
      id: organizationId,
      status: "suspended",
      blocked_users_count: blockedCount,
      suspended_at: new Date(),
      reason: input.reason,
      duration_hours: input.duration_hours,
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Command: Activate vendor (restore login access)
 * 
 * 🎯 Purpose: Reverse suspension after investigation or temporary ban expiry
 * 🔐 Security: Requires PLATFORM_VENDOR_ACTIVATE + note for audit
 */
export async function activateVendorCommand(
  organizationId: string,
  input: ActivateVendorInput,
  actorUserId: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Validate: Organization exists and is currently suspended
    const currentOrg = await findOrganizationWithStats(organizationId, client);
    
    if (!currentOrg) {
      throw new VendorNotFoundError(organizationId);
    }

    if (currentOrg.status !== "suspended") {
      throw new VendorAlreadyActiveError(organizationId);
    }

    // 2️⃣ Execute: Unblock vendor users
    const unblockedCount = await unblockUsersByOrganization(
      organizationId,
      actorUserId,
      {
        roles: [...VENDOR_MANAGEMENT_ROLES],
        note: input.note,
      },
      client // ✅ Within transaction
    );

    // 3️⃣ Execute: Update organization status
    const updatedOrg = await updateOrganization(
      organizationId,
      { status: "active" },
      client // ✅ Within transaction
    );

    // 4️⃣ Audit: Log activation
    await createAuditLog(
      {
        actorUserId,
        organizationId,
        action: "VENDOR_ACTIVATED",
        entityType: "organization",
        entityId: organizationId,
        oldValues: { status: "suspended" },
        newValues: {
          status: "active",
          unblocked_users_count: unblockedCount,
          activation_note: input.note,
        },
        metadata: {
          note: input.note,
          unblocked_user_count: unblockedCount,
          activated_by: "platform_admin",
        },
      },
      client
    );

    await client.query("COMMIT");

    return {
      id: organizationId,
      status: "active",
      unblocked_users_count: unblockedCount,
      activated_at: new Date(),
      note: input.note,
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Command: Soft delete vendor (permanent removal)
 * 
 * 🎯 Purpose: Remove vendor from platform after due process
 * 🔐 Security: Requires PLATFORM_VENDOR_DELETE + safety checks + confirmation
 * ⚠️ Risk: Irreversible (soft delete can be restored, but data is hidden)
 */
export async function deleteVendorCommand(
  organizationId: string,
  actorUserId: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Validate: Organization exists
    const currentOrg = await findOrganizationWithStats(organizationId, client);
    
    if (!currentOrg) {
      throw new VendorNotFoundError(organizationId);
    }

    // 2️⃣ 🔒 Safety Check: Can this vendor be deleted?
    const safetyCheck = await canSoftDeleteOrganization(organizationId, client);
    
    if (!safetyCheck.canDelete) {
      throw new VendorDeleteProtectedError(
        safetyCheck.reasons.join(", "),
        safetyCheck.details
      );
    }

    // 3️⃣ Execute: Soft delete organization
    const deleted = await softDeleteOrganization(organizationId, actorUserId, client);
    
    if (!deleted) {
      throw new Error("DELETE_FAILED");
    }

    // 4️⃣ Execute: Block all users (defense in depth)
    await blockUsersByOrganization(
      organizationId,
      actorUserId,
      { roles: [...VENDOR_MANAGEMENT_ROLES] },
      client
    );

    // 5️⃣ Audit: Log deletion with full context
    await createAuditLog(
      {
        actorUserId,
        organizationId,
        action: "VENDOR_SOFT_DELETED",
        entityType: "organization",
        entityId: organizationId,
        oldValues: {
          deleted_at: null,
          status: currentOrg.status,
        },
        newValues: {
          deleted_at: new Date(),
          status: "suspended",
        },
        metadata: {
          deleted_by: "platform_admin",
          active_products_at_delete: currentOrg.active_products,
          safety_check: safetyCheck,
        },
      },
      client
    );

    await client.query("COMMIT");

    return {
      id: organizationId,
      deleted: true,
      deleted_at: new Date(),
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// =============================================================================
// 🔄 UTILITY: Restore soft-deleted vendor (optional admin feature)
// =============================================================================

export async function restoreVendorCommand(
  organizationId: string,
  actorUserId: string,
  note?: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Validate: Organization exists and is deleted
    const query = `SELECT * FROM organizations WHERE id = $1 AND deleted_at IS NOT NULL`;
    const result = await client.query(query, [organizationId]);
    
    if (result.rows.length === 0) {
      throw new VendorNotFoundError(organizationId);
    }

    // 2️⃣ Execute: Restore organization
    const restored = await restoreOrganization(organizationId, client);
    
    if (!restored) {
      throw new Error("RESTORE_FAILED");
    }

    // 3️⃣ Execute: Unblock users (optional, based on policy)
    await unblockUsersByOrganization(
      organizationId,
      actorUserId,
      { roles: [...VENDOR_MANAGEMENT_ROLES], note },
      client
    );

    // 4️⃣ Audit: Log restoration
    await createAuditLog(
      {
        actorUserId,
        organizationId,
        action: "VENDOR_RESTORED",
        entityType: "organization",
        entityId: organizationId,
        oldValues: { deleted_at: result.rows[0].deleted_at },
        newValues: { deleted_at: null, status: "active" },
        metadata: {
          restored_by: "platform_admin",
          note,
        },
      },
      client
    );

    await client.query("COMMIT");

    return {
      id: organizationId,
      restored: true,
      restored_at: new Date(),
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}