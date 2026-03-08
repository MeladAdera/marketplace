import pool from "../db/database";
import { PoolClient } from "pg";
import crypto from "crypto";
import {
  // Statistics Types
  VendorStatisticsFilters,
  VendorStatisticsResponse,
  TopProductStat,
  // User Types
  VendorUserFilters,
  VendorUserSummary,
} from "../types/vendor-admin.types";
type UUID = string;

// ─────────────────────────────────────────────────────────────
// 🔹 HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Calculate date range based on period type
 */
function getDateRange(
  period?: VendorStatisticsFilters['period'],
  customFrom?: Date,
  customTo?: Date
): { from: Date; to: Date; type: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'today':
      return { from: today, to: now, type: 'today' };
    case 'week': {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      return { from: startOfWeek, to: now, type: 'week' };
    }
    case 'month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfMonth, to: now, type: 'month' };
    }
    case 'quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1);
      return { from: startOfQuarter, to: now, type: 'quarter' };
    }
    case 'year': {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return { from: startOfYear, to: now, type: 'year' };
    }
    case 'custom':
      if (!customFrom || !customTo) {
        const fallbackFrom = new Date(now);
        fallbackFrom.setDate(now.getDate() - 30);
        return { from: fallbackFrom, to: now, type: 'custom' };
      }
      return { from: customFrom, to: customTo, type: 'custom' };
    default:
      const defaultFrom = new Date(now);
      defaultFrom.setDate(now.getDate() - 30);
      return { from: defaultFrom, to: now, type: 'month' };
  }
}

// ─────────────────────────────────────────────────────────────
// 🔹 GET /vendor/statistics - REPOSITORY FUNCTIONS
// ✅ FIXED: Uses transaction with REPEATABLE READ for consistency
// ─────────────────────────────────────────────────────────────

export async function getVendorStatistics(
  organizationId: UUID,
  filters: VendorStatisticsFilters
): Promise<VendorStatisticsResponse['data']> {
  const client = await pool.connect();

  try {
    // ✅ REPEATABLE READ ensures all queries see the same snapshot
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");

    const dateRange = getDateRange(filters.period, filters.fromDate, filters.toDate);

    // ✅ Recent Orders: Always from NOW(), not from dateRange.to
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 7);

    // ── 1) Key Metrics + Status Breakdown (Merged for performance) ──
    const metricsResult = await client.query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'refunded')) AS total_orders,
        COALESCE(SUM(subtotal_amount_cents) FILTER (WHERE status NOT IN ('cancelled', 'refunded')), 0) AS total_revenue_cents,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'accepted') AS accepted,
        COUNT(*) FILTER (WHERE status = 'packed') AS packed,
        COUNT(*) FILTER (WHERE status = 'shipped') AS shipped,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
        COUNT(*) FILTER (WHERE status = 'refunded') AS refunded
      FROM vendor_orders
      WHERE vendor_organization_id = $1
        AND created_at >= $2
        AND created_at <= $3
      `,
      [organizationId, dateRange.from, dateRange.to]
    );

    // ── 2) Recent Activity (Last 7 Days from NOW) ───────────────
    const recentResult = await client.query(
      `
      SELECT COUNT(*) AS recent_count
      FROM vendor_orders
      WHERE vendor_organization_id = $1
        AND created_at >= $2
        AND status NOT IN ('cancelled', 'refunded')
      `,
      [organizationId, recentDate]
    );

    // ── 3) Top Products (By Revenue) ────────────────────────────
    const topProductsResult = await client.query(
      `
      SELECT 
        p.id AS product_id,
        p.name AS product_name,
        v.id AS variant_id,
        v.name AS variant_name,
        SUM(oi.quantity) AS units_sold,
        SUM(oi.quantity * oi.price_snapshot_cents) AS revenue_cents
      FROM order_items oi
      INNER JOIN vendor_orders vo ON oi.vendor_order_id = vo.id
      INNER JOIN variants v ON oi.variant_id = v.id
      INNER JOIN products p ON v.product_id = p.id
      WHERE vo.vendor_organization_id = $1
        AND vo.created_at >= $2
        AND vo.created_at <= $3
        AND vo.status NOT IN ('cancelled', 'refunded')
      GROUP BY p.id, p.name, v.id, v.name
      ORDER BY revenue_cents DESC
      LIMIT 10
      `,
      [organizationId, dateRange.from, dateRange.to]
    );

    // ── 4) Inventory Summary ────────────────────────────────────
    const inventoryResult = await client.query(
      `
      SELECT 
        COUNT(*) AS total_variants,
        COUNT(*) FILTER (WHERE v.stock_quantity < 10 AND v.active = TRUE) AS low_stock_items
      FROM variants v
      INNER JOIN products p ON v.product_id = p.id
      WHERE p.organization_id = $1
        AND p.active = TRUE
        AND p.soft_deleted_at IS NULL
      `,
      [organizationId]
    );

    await client.query("COMMIT");

    // ── Assemble Response ───────────────────────────────────────
    const { total_orders, total_revenue_cents } = metricsResult.rows[0];
    const totalOrders = parseInt(total_orders);
    const totalRevenueCents = parseInt(total_revenue_cents);

    return {
      totalOrders,
      totalRevenueCents,
      averageOrderValueCents: totalOrders > 0 ? Math.round(totalRevenueCents / totalOrders) : 0,
      ordersByStatus: {
        pending: parseInt(metricsResult.rows[0].pending),
        accepted: parseInt(metricsResult.rows[0].accepted),
        packed: parseInt(metricsResult.rows[0].packed),
        shipped: parseInt(metricsResult.rows[0].shipped),
        delivered: parseInt(metricsResult.rows[0].delivered),
        cancelled: parseInt(metricsResult.rows[0].cancelled),
        refunded: parseInt(metricsResult.rows[0].refunded),
      },
      recentOrdersCount: parseInt(recentResult.rows[0].recent_count),
      topProducts: topProductsResult.rows.map((row): TopProductStat => ({
        productId: row.product_id,
        productName: row.product_name,
        variantId: row.variant_id,
        variantName: row.variant_name,
        unitsSold: parseInt(row.units_sold),
        revenueCents: parseInt(row.revenue_cents),
      })),
      lowStockItemsCount: parseInt(inventoryResult.rows[0].low_stock_items),
      totalVariantsCount: parseInt(inventoryResult.rows[0].total_variants),
      period: {
        type: dateRange.type,
        from: dateRange.from,
        to: dateRange.to,
      },
      generatedAt: new Date(),
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// 🔹 GET /vendor/users - REPOSITORY FUNCTIONS
// ✅ Multi-tenant scoped: only returns users with matching organization_id
// ─────────────────────────────────────────────────────────────

export async function findVendorUsersByOrgId(
  organizationId: UUID,
  filters: VendorUserFilters
): Promise<{ users: VendorUserSummary[]; total: number }> {
  const { role, isActive, search, page = 1, limit = 20 } = filters;

  // Build dynamic WHERE clause
  const conditions: string[] = ['u.organization_id = $1'];
  const params: any[] = [organizationId];
  let paramIndex = 2;

  if (role) {
    conditions.push(`u.role = $${paramIndex}`);
    params.push(role);
    paramIndex++;
  }

  if (isActive !== undefined) {
    conditions.push(`u.is_active = $${paramIndex}`);
    params.push(isActive);
    paramIndex++;
  }

  if (search) {
    conditions.push(`u.email ILIKE $${paramIndex}`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  // Count total
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM users u WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Fetch users with pagination
  const offset = (page - 1) * limit;
  params.push(limit, offset);
  const usersResult = await pool.query(
    `
    SELECT 
      u.id,
      u.email,
      u.role,
      u.is_active,
      u.created_at,
      u.last_login_at,
      
      -- ✅ NEW: Blocking fields
      u.blocked,
      u.blocked_at,
      blocker.id AS blocked_by_id,
      blocker.email AS blocked_by_email,
      
      -- Existing: invited by
      inviter.id AS invited_by_id,
      inviter.email AS invited_by_email
    FROM users u
    LEFT JOIN users blocker ON u.blocked_by = blocker.id  -- ✅ NEW JOIN
    LEFT JOIN users inviter ON u.invited_by_id = inviter.id
    WHERE ${whereClause}
    ORDER BY u.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `,
    params
  );

  const users: VendorUserSummary[] = usersResult.rows.map((row): VendorUserSummary => ({
    id: row.id,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    
    // ✅ NEW: Map blocking fields
    blocked: row.blocked,
    blockedAt: row.blocked_at,
    blockedBy: row.blocked_by_id ? {
      id: row.blocked_by_id,
      email: row.blocked_by_email,
    } : null,
    
    // Existing: invited by
    invitedBy: row.invited_by_id ? {
      id: row.invited_by_id,
      email: row.invited_by_email,
    } : null,
  }));

  return { users, total };
}
// ─────────────────────────────────────────────────────────────
// 🔹 GET /vendor/users/:id - REPOSITORY
// ✅ Multi-tenant scoped: only returns user if belongs to organization
// ─────────────────────────────────────────────────────────────

// في src/repository/vendor-admin.repo.ts

export async function findVendorUserById(
  userId: UUID,
  organizationId: UUID
): Promise<VendorUserSummary | null> {
  
  const query = `
    SELECT 
      u.id,
      u.email,
      u.role,
      u.is_active,
      u.created_at,
      u.last_login_at,
      
      -- ✅ Blocking fields
      u.blocked,
      u.blocked_at,
      blocker.id AS blocked_by_id,
      blocker.email AS blocked_by_email,
      
      -- Invited by
      inviter.id AS invited_by_id,
      inviter.email AS invited_by_email
    FROM users u
    LEFT JOIN users blocker ON u.blocked_by = blocker.id
    LEFT JOIN users inviter ON u.invited_by_id = inviter.id
    WHERE u.id = $1 AND u.organization_id = $2
    LIMIT 1
  `;

  const result = await pool.query(query, [userId, organizationId]);
  
  if (result.rows.length === 0) return null;

  const row = result.rows[0];

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    
    // ✅ Map blocking fields
    blocked: row.blocked,
    blockedAt: row.blocked_at,
    blockedBy: row.blocked_by_id ? {
      id: row.blocked_by_id,
      email: row.blocked_by_email,
    } : null,
    
    // Map invited by
    invitedBy: row.invited_by_id ? {
      id: row.invited_by_id,
      email: row.invited_by_email,
    } : null,
  };
}
// ─────────────────────────────────────────────────────────────
// 🔹 PATCH /vendor/users/:id/block - REPOSITORY (FIXED)
// ─────────────────────────────────────────────────────────────

export async function blockUserInOrg(
  targetUserId: UUID,
  organizationId: UUID,
  blockedByUserId: UUID,
  blocked: boolean,
  reason?: string,
  client?: PoolClient
): Promise<{ 
  userId: UUID; 
  email: string; 
  isBlocked: boolean; 
  blockedAt: Date | null 
}> {
  
  const runner = client || pool;

  // ── 1) Safety Check: Cannot block yourself ─────────────────
  if (targetUserId === blockedByUserId) {
    throw new Error("CANNOT_BLOCK_SELF");
  }

  // ── 2) Safety Check: Cannot block the last vendor_admin ───
  if (blocked) {
    const adminCountResult = await runner.query(
      `
      SELECT COUNT(*) as count
      FROM users
      WHERE organization_id = $1
        AND role = 'vendor_admin'
        AND is_active = TRUE
        AND id != $2
      `,
      [organizationId, targetUserId]
    );

    const adminCount = parseInt(adminCountResult.rows[0].count);
    
    if (adminCount === 0) {
      throw new Error("CANNOT_BLOCK_LAST_ADMIN");
    }
  }

  // ── 3) Execute Update (FIXED: Restore is_active on unblock) ──
  const result = await runner.query(
    `
    UPDATE users
    SET 
      blocked = $1,
      blocked_at = CASE WHEN $1 = TRUE THEN NOW() ELSE NULL END,
      blocked_by = CASE WHEN $1 = TRUE THEN $2::uuid ELSE NULL END,
      
      -- ✅ FIXED: When blocking → deactivate, When unblocking → reactivate
      is_active = CASE 
        WHEN $1 = TRUE THEN FALSE   -- Block: set inactive
        ELSE TRUE                   -- Unblock: restore active
      END,
      
      updated_at = NOW()
    WHERE id = $3
      AND organization_id = $4
    RETURNING id, email, blocked, blocked_at
    `,
    [blocked, blockedByUserId, targetUserId, organizationId]
  );

  if (result.rows.length === 0) {
    throw new Error("USER_NOT_FOUND_IN_ORG");
  }

  const row = result.rows[0];

  return {
    userId: row.id,
    email: row.email,
    isBlocked: row.blocked,
    blockedAt: row.blocked_at,
  };
}
// ─────────────────────────────────────────────────────────────
// 🔹 PATCH /vendor/users/:id/role - REPOSITORY
// Downgrade user role (admin → staff only)
// ✅ Includes: Self-protection + Last-admin protection
// ─────────────────────────────────────────────────────────────

export async function downgradeUserRoleInOrg(
  targetUserId: UUID,
  organizationId: UUID,
  actorUserId: UUID,
  newRole: 'vendor_staff',
  reason?: string,
  client?: PoolClient
): Promise<{ 
  userId: UUID; 
  email: string; 
  oldRole: string; 
  newRole: string 
}> {
  
  const runner = client || pool;

  // ── 1) Safety Check: Cannot change your own role ───────────
  if (targetUserId === actorUserId) {
    throw new Error("CANNOT_CHANGE_OWN_ROLE");
  }

  // ── 2) Fetch Current Role ──────────────────────────────────
  const currentResult = await runner.query(
    `
    SELECT role, email 
    FROM users 
    WHERE id = $1 AND organization_id = $2
    LIMIT 1
    `,
    [targetUserId, organizationId]
  );

  if (currentResult.rows.length === 0) {
    throw new Error("USER_NOT_FOUND_IN_ORG");
  }

  const oldRole = currentResult.rows[0].role;
  const email = currentResult.rows[0].email;

  // ── 3) Cannot Downgrade Customer ───────────────────────────
  if (oldRole === 'customer') {
    throw new Error("CANNOT_DOWNGRADE_CUSTOMER");
  }

  // ── 4) Already Staff ───────────────────────────────────────
  if (oldRole === 'vendor_staff') {
    throw new Error("USER_ALREADY_STAFF");
  }

  // ── 5) Last Admin Protection ───────────────────────────────
  if (oldRole === 'vendor_admin') {
    const adminCountResult = await runner.query(
      `
      SELECT COUNT(*) as count
      FROM users
      WHERE organization_id = $1
        AND role = 'vendor_admin'
        AND is_active = TRUE
        AND id != $2  -- Exclude target user
      `,
      [organizationId, targetUserId]
    );

    const adminCount = parseInt(adminCountResult.rows[0].count);
    
    if (adminCount === 0) {
      throw new Error("CANNOT_DOWNGRADE_LAST_ADMIN");
    }
  }

  // ── 6) Execute Downgrade ───────────────────────────────────
  const result = await runner.query(
    `
    UPDATE users
    SET 
      role = $1,
      updated_at = NOW()
    WHERE id = $2 
      AND organization_id = $3 
      AND role = 'vendor_admin'  -- Ensure we're only downgrading admins
    RETURNING id, email, role
    `,
    [newRole, targetUserId, organizationId]
  );

  if (result.rows.length === 0) {
    throw new Error("ROLE_UPDATE_FAILED");
  }

  return {
    userId: result.rows[0].id,
    email: result.rows[0].email,
    oldRole,
    newRole,
  };
}