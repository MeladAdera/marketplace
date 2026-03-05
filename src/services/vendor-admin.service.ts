import {
  // Statistics Repo
  getVendorStatistics,
  // Users Repo
  findVendorUsersByOrgId,
  findVendorUserById,
  blockUserInOrg,
  downgradeUserRoleInOrg,

} from "../repository/vendor-admin.repo";
import {
  // Statistics Types
  VendorStatisticsFilters,
  VendorStatisticsResponse,
  // Users Types
  VendorUserFilters,
  VendorUserListResponse,
  InviteVendorUserInput,
  InviteVendorUserResponse,
  VendorUserSummary,
} from "../types/vendor-admin.types";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "../errors/AppError";
import { AuditService } from "./audit.service";

type UUID = string;

// ─────────────────────────────────────────────────────────────
// 🔹 GET /vendor/statistics - SERVICE
// ─────────────────────────────────────────────────────────────

export async function getVendorStatisticsService(
  organizationId: UUID,
  filters: VendorStatisticsFilters,
  t?: (key: string, params?: any) => string
): Promise<VendorStatisticsResponse> {
  
  // ✅ No additional business logic needed here
  // The repo handles all the complex queries with transaction
  
  const statistics = await getVendorStatistics(organizationId, filters);

  // ✅ Log the access (non-blocking, for audit trail)
  await AuditService.log({
    actorUserId: "", // Will be filled by controller
    organizationId,
    action: "VENDOR_STATISTICS_VIEWED",
    entityType: "statistics",
    entityId: organizationId,
    metadata: {
      period: filters.period || 'default',
      generatedAt: statistics.generatedAt,
    },
  }).catch((err: Error) => console.error("Audit log failed:", err));

  return {
    success: true,
    data: statistics,
  };
}

// ─────────────────────────────────────────────────────────────
// 🔹 GET /vendor/users - SERVICE
// ─────────────────────────────────────────────────────────────

export async function listVendorUsersService(
  organizationId: UUID,
  filters: VendorUserFilters,
  t?: (key: string, params?: any) => string
): Promise<VendorUserListResponse> {
  
  // ✅ Validate pagination params
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 20)); // Cap at 100

  const { users, total } = await findVendorUsersByOrgId(organizationId, {
    ...filters,
    page,
    limit,
  });

  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    data: {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    },
  };
}
// ─────────────────────────────────────────────────────────────
// 🔹 GET /vendor/users/:id - SERVICE
// Get single user details within the organization
// ─────────────────────────────────────────────────────────────

export async function getVendorUserService(
  userId: UUID,
  organizationId: UUID,
  t?: (key: string, params?: any) => string
): Promise<{ success: true; data: VendorUserSummary }> {
  
  const user = await findVendorUserById(userId, organizationId);

  if (!user) {
    throw new NotFoundError(
      t?.("vendor.user_not_found", { ns: "errors" }) || 
      "User not found in your organization"
    );
  }

  return {
    success: true,
    data: user,
  };
}
// ─────────────────────────────────────────────────────────────
// 🔹 PATCH /vendor/users/:id/block - SERVICE
// Block or unblock a user within the organization
// ─────────────────────────────────────────────────────────────

export async function blockVendorUserService(
  targetUserId: UUID,
  organizationId: UUID,
  actorUserId: UUID,
  input: { blocked: boolean; reason?: string },
  t?: (key: string, params?: any) => string
): Promise<{
  success: true;
  data: {
    userId: UUID;
    email: string;
    isBlocked: boolean;
    blockedAt: Date | null;
    message: string;
  };
}> {
  
  try {
    const result = await blockUserInOrg(
      targetUserId,
      organizationId,
      actorUserId,
      input.blocked,
      input.reason
    );

    // ── Audit Log (Non-blocking) ────────────────────────────
    await AuditService.log({
      actorUserId,
      organizationId,
      action: input.blocked ? "VENDOR_USER_BLOCKED" : "VENDOR_USER_UNBLOCKED",
      entityType: "user",
      entityId: targetUserId,
      newValues: { 
        blocked: input.blocked, 
        reason: input.reason 
      },
      metadata: { 
        targetEmail: result.email,
        blockedAt: result.blockedAt,
      },
    }).catch((err: Error) => console.error("Audit log failed:", err));

    return {
      success: true,
      data: {
        userId: result.userId,
        email: result.email,
        isBlocked: result.isBlocked,
        blockedAt: result.blockedAt,
        message: input.blocked 
          ? t?.("vendor.user_blocked", { ns: "vendor" }) || "User has been blocked"
          : t?.("vendor.user_unblocked", { ns: "vendor" }) || "User has been unblocked",
      },
    };

  } catch (error: any) {
    // ── Map Repo Errors to AppErrors ────────────────────────
    if (error.message === "CANNOT_BLOCK_SELF") {
      throw new ValidationError(
        t?.("vendor.cannot_block_self", { ns: "errors" }) || 
        "You cannot block yourself"
      );
    }
    if (error.message === "CANNOT_BLOCK_LAST_ADMIN") {
      throw new ValidationError(
        t?.("vendor.cannot_block_last_admin", { ns: "errors" }) || 
        "Cannot block the last administrator in your organization"
      );
    }
    if (error.message === "USER_NOT_FOUND_IN_ORG") {
      throw new NotFoundError(
        t?.("vendor.user_not_found", { ns: "errors" }) || 
        "User not found in your organization"
      );
    }
    throw error;
  }
}
// ─────────────────────────────────────────────────────────────
// 🔹 PATCH /vendor/users/:id/role - SERVICE
// Update user role (Downgrade only: admin → staff)
// ─────────────────────────────────────────────────────────────

export async function updateVendorUserRoleService(
  targetUserId: UUID,
  organizationId: UUID,
  actorUserId: UUID,
  input: { newRole: 'vendor_staff'; reason?: string },
  t?: (key: string, params?: any) => string
): Promise<{
  success: true;
  data: {
    userId: UUID;
    email: string;
    oldRole: string;
    newRole: string;
    message: string;
  };
}> {
  
  try {
    const result = await downgradeUserRoleInOrg(
      targetUserId,
      organizationId,
      actorUserId,
      input.newRole,
      input.reason
    );

    // ── Audit Log (Non-blocking) ────────────────────────────
    await AuditService.log({
      actorUserId,
      organizationId,
      action: "VENDOR_USER_ROLE_UPDATED",
      entityType: "user",
      entityId: targetUserId,
      oldValues: { role: result.oldRole },
      newValues: { role: result.newRole, reason: input.reason },
      metadata: { 
        targetEmail: result.email,
        changedBy: actorUserId,
      },
    }).catch((err: Error) => console.error("Audit log failed:", err));

    return {
      success: true,
      data: {
        userId: result.userId,
        email: result.email,
        oldRole: result.oldRole,
        newRole: result.newRole,
        message: t?.("vendor.role_updated", { ns: "vendor" }) || "User role has been updated",
      },
    };

  } catch (error: any) {
    // ── Map Repo Errors to AppErrors ────────────────────────
    if (error.message === "CANNOT_CHANGE_OWN_ROLE") {
      throw new ValidationError(
        t?.("vendor.cannot_change_own_role", { ns: "errors" }) || 
        "You cannot change your own role"
      );
    }
    if (error.message === "CANNOT_DOWNGRADE_LAST_ADMIN") {
      throw new ValidationError(
        t?.("vendor.cannot_downgrade_last_admin", { ns: "errors" }) || 
        "Cannot downgrade the last administrator in your organization"
      );
    }
    if (error.message === "USER_ALREADY_STAFF") {
      throw new ValidationError(
        t?.("vendor.user_already_staff", { ns: "errors" }) || 
        "User is already a staff member"
      );
    }
    if (error.message === "CANNOT_DOWNGRADE_CUSTOMER") {
      throw new ValidationError(
        t?.("vendor.cannot_downgrade_customer", { ns: "errors" }) || 
        "Cannot change role of a customer account"
      );
    }
    if (error.message === "USER_NOT_FOUND_IN_ORG") {
      throw new NotFoundError(
        t?.("vendor.user_not_found", { ns: "errors" }) || 
        "User not found in your organization"
      );
    }
    throw error;
  }
}
