// src/repository/platform-admin.repo.ts
// Platform Admin - Vendor Management Repository
// All queries support optional PoolClient for transaction safety

import pool from "../db/database";
import { PoolClient } from "pg";
import { Organization } from "../types/organization.types";

// =============================================================================
// TYPES
// =============================================================================

export interface AdminVendorListItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  deleted_at: Date | null;
  created_at: Date;
  product_count: number;
  user_count: number;
}

export interface AdminVendorDetails {
  id: string;
  name: string;
  slug: string;
  status: string;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  total_products: string;    
  active_products: string;
  admin_count: string;
  staff_count: string;
  blocked_users_count: string;
}

export interface VendorDeletionSafetyCheck {
  canDelete: boolean;
  reasons: string[];
  details: {
    active_products: number;
    pending_orders: number;
    active_carts: number;
  };
}

// =============================================================================
// LIST VENDORS (PAGINATED + FILTERED)
// =============================================================================

export async function listOrganizationsAdmin(
  filters: {
    page?: number;
    limit?: number;
    status?: 'active' | 'suspended' | 'deleted';
    search?: string;
    sortBy?: 'created_at' | 'name' | 'status';
    sortOrder?: 'asc' | 'desc';
  },
  client?: PoolClient
): Promise<{ organizations: AdminVendorListItem[]; pagination: any }> {
  
  const db = client || pool;
  
  const {
    page = 1,
    limit = 20,
    status,
    search,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = filters;

  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const values: any[] = [];
  let paramCounter = 1;

  // Filter by status (handle soft-delete)
  if (status === 'deleted') {
    conditions.push(`o.deleted_at IS NOT NULL`);
  } else {
    // Default: exclude soft-deleted
    conditions.push(`o.deleted_at IS NULL`);
    if (status && ['active', 'suspended'].includes(status)) {
      conditions.push(`o.status = $${paramCounter}`);
      values.push(status);
      paramCounter++;
    }
  }

  // Search by name or slug
  if (search?.trim()) {
    conditions.push(`(o.name ILIKE $${paramCounter} OR o.slug ILIKE $${paramCounter})`);
    values.push(`%${search.trim()}%`);
    paramCounter++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Validate sort column (prevent SQL injection)
  const validSortColumns = ['created_at', 'name', 'status'];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
  const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Main query with subqueries for stats
  const query = `
    SELECT
      o.id,
      o.name,
      o.slug,
      o.status,
      o.deleted_at,
      o.created_at,
      o.updated_at,
      -- Subquery: count active products (not soft-deleted)
      (
        SELECT COUNT(*)
        FROM products p
        WHERE p.organization_id = o.id
          AND p.soft_deleted_at IS NULL
          AND p.active = true
      ) AS product_count,
      -- Subquery: count active vendor users (exclude customers)
      (
        SELECT COUNT(*)
        FROM users u
        WHERE u.organization_id = o.id
          AND u.role IN ('vendor_admin', 'vendor_staff')
          AND u.blocked = false
          AND u.is_active = true
      ) AS user_count
    FROM organizations o
    ${whereClause}
    ORDER BY o.${sortColumn} ${sortDirection}
    LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
  `;

  values.push(limit, offset);

  const result = await db.query<AdminVendorListItem>(query, values);

  // Also get total count for pagination
  const countQuery = `
    SELECT COUNT(*) as total
    FROM organizations o
    ${whereClause}
  `;
  const countResult = await db.query(countQuery, values.slice(0, -2));
  const total = parseInt(countResult.rows[0].total);

  return {
    organizations: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: offset + result.rows.length < total,
      hasPrevious: page > 1,
    },
  };
}

// =============================================================================
// GET VENDOR DETAILS (WITH STATS)
// =============================================================================

export async function findOrganizationWithStats(
  organizationId: string,
  client?: PoolClient
): Promise<AdminVendorDetails | null> {
  
  const db = client || pool;
  
  const query = `
    SELECT
      o.id,
      o.name,
      o.slug,
      o.status,
      o.deleted_at,
      o.created_at,
      o.updated_at,
      -- Product stats
      (
        SELECT COUNT(*)
        FROM products p
        WHERE p.organization_id = o.id
          AND p.soft_deleted_at IS NULL
      ) AS total_products,
      (
        SELECT COUNT(*)
        FROM products p
        WHERE p.organization_id = o.id
          AND p.soft_deleted_at IS NULL
          AND p.active = true
      ) AS active_products,
      -- User stats
      (
        SELECT COUNT(*)
        FROM users u
        WHERE u.organization_id = o.id
          AND u.role = 'vendor_admin'
      ) AS admin_count,
      (
        SELECT COUNT(*)
        FROM users u
        WHERE u.organization_id = o.id
          AND u.role = 'vendor_staff'
      ) AS staff_count,
      (
        SELECT COUNT(*)
        FROM users u
        WHERE u.organization_id = o.id
          AND u.role IN ('vendor_admin', 'vendor_staff')
          AND u.blocked = true
      ) AS blocked_users_count
    FROM organizations o
    WHERE o.id = $1
      AND o.deleted_at IS NULL
    LIMIT 1
  `;

  const result = await db.query<AdminVendorDetails>(query, [organizationId]);
  return result.rows[0] || null;
}

// =============================================================================
// SOFT DELETE ORGANIZATION
// =============================================================================

export async function softDeleteOrganization(
  organizationId: string,
  deletedBy: string,
  client?: PoolClient
): Promise<boolean> {
  
  const db = client || pool;
  
  const query = `
    UPDATE organizations
    SET 
      deleted_at = NOW(),
      status = 'suspended',
      updated_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL  -- Prevent double-delete
    RETURNING id
  `;

  const result = await db.query(query, [organizationId]);
  return result.rows.length > 0;
}

// =============================================================================
// RESTORE SOFT-DELETED ORGANIZATION (OPTIONAL UTILITY)
// =============================================================================

export async function restoreOrganization(
  organizationId: string,
  client?: PoolClient
): Promise<boolean> {
  
  const db = client || pool;
  
  const query = `
    UPDATE organizations
    SET 
      deleted_at = NULL,
      status = 'active',
      updated_at = NOW()
    WHERE id = $1
      AND deleted_at IS NOT NULL
    RETURNING id
  `;

  const result = await db.query(query, [organizationId]);
  return result.rows.length > 0;
}

// =============================================================================
// SAFETY CHECK: CAN VENDOR BE DELETED?
// =============================================================================

export async function canSoftDeleteOrganization(
  organizationId: string,
  client?: PoolClient
): Promise<VendorDeletionSafetyCheck> {
  
  const db = client || pool;
  const reasons: string[] = [];
  let activeProducts = 0;
  let pendingOrders = 0;
  let activeCarts = 0;

  // 1. Check for active products
  const productsResult = await db.query(
    `SELECT COUNT(*) as count FROM products 
     WHERE organization_id = $1 AND soft_deleted_at IS NULL AND active = true`,
    [organizationId]
  );
  activeProducts = parseInt(productsResult.rows[0].count);
  if (activeProducts > 0) {
    reasons.push(`Has ${activeProducts} active product(s)`);
  }

  // 2. Check for pending/processing vendor orders (vendor_orders has vendor_organization_id)
  try {
    const ordersResult = await db.query(
      `SELECT COUNT(*) as count FROM vendor_orders 
       WHERE vendor_organization_id = $1 
         AND status IN ('pending', 'accepted', 'packed', 'shipped')`,
      [organizationId]
    );
    pendingOrders = parseInt(ordersResult.rows[0].count);
    if (pendingOrders > 0) {
      reasons.push(`Has ${pendingOrders} pending/processing order(s)`);
    }
  } catch (error) {
    console.warn("Vendor orders table not available for deletion check");
  }

  // 3. Check for active cart items (if carts table exists)
  try {
    const cartsResult = await db.query(
      `SELECT COUNT(DISTINCT c.id) as count 
       FROM carts c
       JOIN cart_items ci ON ci.cart_id = c.id
       JOIN variants v ON v.id = ci.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE p.organization_id = $1`,
      [organizationId]
    );
    activeCarts = parseInt(cartsResult.rows[0].count);
    if (activeCarts > 0) {
      reasons.push(`Appears in ${activeCarts} active cart(s)`);
    }
  } catch (error) {
    // Carts table might not exist yet, skip this check
    console.warn("Carts table not available for deletion check");
  }

  return {
    canDelete: reasons.length === 0,
    reasons,
    details: {
      active_products: activeProducts,
      pending_orders: pendingOrders,
      active_carts: activeCarts,
    },
  };
}

// =============================================================================
// GET BLOCK STATUS SUMMARY
// =============================================================================

export async function getOrganizationBlockStatus(
  organizationId: string,
  client?: PoolClient
) {
  
  const db = client || pool;
  
  const query = `
    SELECT
      COUNT(*) FILTER (WHERE blocked = true) as blocked_count,
      COUNT(*) FILTER (WHERE blocked = false AND is_active = true) as active_count,
      ARRAY_AGG(
        CASE WHEN blocked = true THEN 
          json_build_object(
            'user_id', id,
            'email', email,
            'role', role,
            'blocked_at', blocked_at,
            'blocked_by', blocked_by
          )
        END
      ) FILTER (WHERE blocked = true) as blocked_users
    FROM users
    WHERE organization_id = $1
      AND role IN ('vendor_admin', 'vendor_staff')
  `;

  const result = await db.query(query, [organizationId]);
  return result.rows[0];
}