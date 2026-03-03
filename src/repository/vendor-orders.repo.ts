import pool from "../db/database";
import { PoolClient } from "pg";
import { 
  VendorOrderSummary, 
  VendorOrderFilters 
} from "../types/vendor-admin.types";
import { VendorOrderStatus } from "../types/order.types";
import { createAuditLog } from "./audit.repo";

// ─────────────────────────────────────────────────────────────
// 🔹 LIST VENDOR ORDERS (GET /vendor/orders)
// ✅ هذه هي الدالة الناقصة التي تسبب الخطأ!
// ─────────────────────────────────────────────────────────────

export async function findVendorOrdersByOrgId(
  organizationId: string,
  filters: VendorOrderFilters
): Promise<{ orders: VendorOrderSummary[]; total: number }> {
  
  const { status, fromDate, toDate, page = 1, limit = 20 } = filters;
  
  const conditions: string[] = ['vo.vendor_organization_id = $1'];
  const params: any[] = [organizationId];
  let paramIndex = 2;

  if (status) {
    conditions.push(`vo.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }
  if (fromDate) {
    conditions.push(`vo.created_at >= $${paramIndex}`);
    params.push(fromDate);
    paramIndex++;
  }
  if (toDate) {
    conditions.push(`vo.created_at <= $${paramIndex}`);
    params.push(toDate);
    paramIndex++;
  }

  const whereClause = conditions.join(" AND ");

  // Count query
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM vendor_orders vo WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  const offset = (page - 1) * limit;
  const limitParamIndex = paramIndex;
  const offsetParamIndex = paramIndex + 1;
  params.push(limit, offset);

  const ordersResult = await pool.query(
    `
    SELECT 
      vo.id,
      vo.status,
      vo.subtotal_amount_cents,
      vo.created_at,
      vo.updated_at,
      o.order_number,
      u.email AS customer_email,
      COUNT(oi.id) AS item_count,
      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,
            'productName', oi.product_name_snapshot,
            'variantName', v.name,
            'sku', oi.sku_snapshot,
            'quantity', oi.quantity,
            'priceSnapshotCents', oi.price_snapshot_cents
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::json
      ) AS items_json
    FROM vendor_orders vo
    INNER JOIN orders o ON vo.order_id = o.id
    INNER JOIN users u ON o.customer_user_id = u.id
    LEFT JOIN order_items oi ON vo.id = oi.vendor_order_id
    LEFT JOIN variants v ON oi.variant_id = v.id
    WHERE ${whereClause}
    GROUP BY vo.id, o.order_number, u.email
    ORDER BY vo.created_at DESC
    LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `,
    params
  );

  const orders: VendorOrderSummary[] = ordersResult.rows.map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    status: row.status as VendorOrderStatus,
    subtotalAmountCents: row.subtotal_amount_cents,
    itemCount: parseInt(row.item_count),
    customerEmail: row.customer_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: typeof row.items_json === "string"
      ? JSON.parse(row.items_json)
      : row.items_json,
  }));

  return { orders, total };
}

// ─────────────────────────────────────────────────────────────
// 🔹 GET SINGLE VENDOR ORDER (GET /vendor/orders/:id)
// ✅ هذه الدالة التي أضفتها سابقاً (تأكد أنها مصدرة بـ export)
// ─────────────────────────────────────────────────────────────

export async function findVendorOrderById(
  orderId: string,
  organizationId: string
): Promise<VendorOrderSummary | null> {
  
  const query = `
    SELECT 
      vo.id,
      vo.status,
      vo.subtotal_amount_cents,
      vo.created_at,
      vo.updated_at,
      o.order_number,
      u.email AS customer_email,
      COUNT(oi.id) AS item_count,
      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,
            'productName', oi.product_name_snapshot,
            'variantName', v.name,
            'sku', oi.sku_snapshot,
            'quantity', oi.quantity,
            'priceSnapshotCents', oi.price_snapshot_cents
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::json
      ) AS items_json
    FROM vendor_orders vo
    INNER JOIN orders o ON vo.order_id = o.id
    INNER JOIN users u ON o.customer_user_id = u.id
    LEFT JOIN order_items oi ON vo.id = oi.vendor_order_id
    LEFT JOIN variants v ON oi.variant_id = v.id
    WHERE vo.id = $1 
      AND vo.vendor_organization_id = $2
    GROUP BY vo.id, o.order_number, u.email
    LIMIT 1
  `;

  const result = await pool.query(query, [orderId, organizationId]);
  
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status as VendorOrderStatus,
    subtotalAmountCents: row.subtotal_amount_cents,
    itemCount: parseInt(row.item_count),
    customerEmail: row.customer_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: typeof row.items_json === 'string' 
      ? JSON.parse(row.items_json) 
      : row.items_json,
  };
}

// ─────────────────────────────────────────────────────────────
// 🔹 UPDATE ORDER STATUS (PATCH /vendor/orders/:id/status)
// ✅ تأكد أنها مصدرة بـ export أيضاً
// ─────────────────────────────────────────────────────────────

export async function updateVendorOrderStatus(
  orderId: string,
  organizationId: string,
  newStatus: VendorOrderStatus,
  actorUserId: string,
  note?: string,
  client?: PoolClient
): Promise<{ id: string; status: VendorOrderStatus }> {
  
  const runner = client || pool;

  const result = await runner.query(
    `
    UPDATE vendor_orders
    SET status = $1, updated_at = NOW()
    WHERE id = $2 
      AND vendor_organization_id = $3
      AND status NOT IN ('delivered', 'cancelled', 'refunded')
    RETURNING id, status
    `,
    [newStatus, orderId, organizationId]
  );

  if (result.rows.length === 0) {
    throw new Error("STATUS_UPDATE_FAILED");
  }

  // Audit log (non-blocking if no transaction)
  const auditPromise = createAuditLog({
    actorUserId,
    organizationId,
    action: "VENDOR_ORDER_STATUS_UPDATED",
    entityType: "vendor_order",
    entityId: orderId,
    oldValues: null,
    newValues: { status: newStatus, note },
    metadata: { newStatus, note },
  }, client);

  if (!client) {
    auditPromise.catch(err => console.error("Audit log failed:", err));
  }

  return {
    id: result.rows[0].id,
    status: result.rows[0].status,
  };
}