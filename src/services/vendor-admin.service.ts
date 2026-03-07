import {
  // Statistics Repo
  getVendorStatistics,
  // Users Repo
  findVendorUsersByOrgId,

} from "../repository/vendor-admin.repo";
import {
  // Statistics Types
  VendorStatisticsFilters,
  VendorStatisticsResponse,
  // Users Types
  VendorUserFilters,
  VendorUserListResponse,
} from "../types/vendor-admin.types";

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
  const limit = Math.min(100, Math.max(1, filters.limit || 20)); 

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

