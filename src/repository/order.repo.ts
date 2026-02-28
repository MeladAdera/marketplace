// src/repository/order.repo.ts
import pool from "../db/database";
import { PoolClient } from "pg";
import {
  // API Response Types
  OrderWithDetailsResponse,
  OrderSummaryResponse,
  VendorOrderWithItemsResponse,
  OrderItemWithVariantResponse,
  // Internal Types
  LockedCartItem,
  VendorOrderGroup,
  OrderCreationResult,
  // Filters
  OrderFilters,
} from "../types/order.types";

// ─────────────────────────────────────────────────────────────
// 🔐 IDEMPOTENCY CHECK (Read-only, no transaction needed)
// ─────────────────────────────────────────────────────────────

/**
 * Check if an order already exists for this client_request_id
 * Returns the existing order if found (for idempotent response)
 */
export async function checkIdempotency(
  clientRequestId: string,
  customerUserId: string
): Promise<OrderWithDetailsResponse | null> {
  // First check if order exists
  const orderCheck = await pool.query(
    `
    SELECT id, order_number, status, total_amount_cents, client_request_id, 
           created_at, updated_at, customer_user_id
    FROM orders
    WHERE client_request_id = $1 
      AND customer_user_id = $2
    LIMIT 1
    `,
    [clientRequestId, customerUserId]
  );

  if (orderCheck.rows.length === 0) {
    return null;
  }

  // If found, fetch full details to return cached response
  return await getOrderWithDetailsQuery(orderCheck.rows[0].id, customerUserId);
}

// ─────────────────────────────────────────────────────────────
// 🔒 CART LOCKING (MUST be called inside transaction with PoolClient)
// ─────────────────────────────────────────────────────────────

/**
 * Locks user's cart items + fetches variant/product/vendor data
 * Uses FOR UPDATE to prevent concurrent modifications during checkout
 * @throws "CART_EMPTY" if no items
 * @throws "VARIANT_NOT_FOUND_OR_INACTIVE" if any variant is invalid
 * @throws "INSUFFICIENT_STOCK" if requested quantity > available
 */
export async function lockCartItemsForCheckout(
  client: PoolClient,
  userId: string
): Promise<LockedCartItem[]> {
  const query = `
    SELECT 
      ci.id AS cart_item_id,
      ci.variant_id,
      ci.quantity,
      v.price_cents,
      v.sku,
      p.name AS product_name,
      p.organization_id,
      o.name AS vendor_name,
      v.stock_quantity AS current_stock
    FROM cart_items ci
    INNER JOIN variants v ON ci.variant_id = v.id
    INNER JOIN products p ON v.product_id = p.id
    INNER JOIN organizations o ON p.organization_id = o.id
    INNER JOIN carts c ON ci.cart_id = c.id
    WHERE c.user_id = $1
      AND v.active = TRUE
      AND p.active = TRUE
      AND p.soft_deleted_at IS NULL
      AND o.status = 'active'
    FOR UPDATE OF ci, v  -- Lock cart_items AND variants to prevent race conditions
  `;

  const result = await client.query(query, [userId]);

  if (result.rows.length === 0) {
    throw new Error("CART_EMPTY");
  }

  // Validate stock for each item (after locking)
  const items: LockedCartItem[] = result.rows.map((row): LockedCartItem => {
    if (row.quantity > row.current_stock) {
      throw new Error("INSUFFICIENT_STOCK");
    }
    return {
      cartItemId: row.cart_item_id,
      variantId: row.variant_id,
      quantity: row.quantity,
      priceCents: row.price_cents,
      sku: row.sku,
      productName: row.product_name,
      organizationId: row.organization_id,
      vendorName: row.vendor_name,
      currentStock: row.current_stock,
    };
  });

  return items;
}

// ─────────────────────────────────────────────────────────────
// 🧾 ORDER CREATION (MUST be called inside transaction)
// ─────────────────────────────────────────────────────────────

/**
 * Generates a human-readable order number (e.g., "ORD-2024-000123")
 */
/**
 * Generates a human-readable order number (e.g., "ORD-20240115-000123")
 * Simplified version without complex regex in SQL
 */
export async function generateOrderNumber(client: PoolClient): Promise<string> {
  const today = new Date().toISOString().split('T')[0]; // "2024-01-15"
  const datePrefix = today.replace(/-/g, ''); // "20240115"
  
  // Get the last order number for today
  const result = await client.query(
    `
    SELECT order_number 
    FROM orders 
    WHERE order_number LIKE $1 
    ORDER BY order_number DESC 
    LIMIT 1
    `,
    [`ORD-${datePrefix}-%`]
  );
  
  let nextNum = 1;
  
  if (result.rows.length > 0) {
    const lastOrderNumber = result.rows[0].order_number;
    // Extract the sequence number using JavaScript regex (safer & simpler)
    // Format: "ORD-20240115-000123" -> extract "000123" -> 123
    const match = lastOrderNumber.match(/ORD-\d{8}-(\d+)$/);
    if (match && match[1]) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }
  
  
  // Format: ORD-YYYYMMDD-NNNNNN (6-digit sequence)
  return `ORD-${datePrefix}-${String(nextNum).padStart(6, '0')}`;
}

/**
 * Creates the main order record
 */
export async function createMainOrder(
  client: PoolClient,
  params: {
    orderNumber: string;
    customerUserId: string;
    status: string;
    totalAmountCents: number;
    clientRequestId: string;
    shippingAddress: any; // JSONB
    notes?: string;
  }
): Promise<string> {
  const result = await client.query(
    `
    INSERT INTO orders (
      order_number,
      customer_user_id,
      status,
      total_amount_cents,
      client_request_id,
      shipping_address,
      notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
    `,
    [
      params.orderNumber,
      params.customerUserId,
      params.status,
      params.totalAmountCents,
      params.clientRequestId,
      params.shippingAddress,
      params.notes || null,
    ]
  );

  return result.rows[0].id;
}

/**
 * Creates vendor sub-orders and returns mapping: vendorId → vendorOrderId
 */
export async function createVendorOrders(
  client: PoolClient,
  orderId: string,
  vendorGroups: VendorOrderGroup[]
): Promise<Record<string, string>> {
  const vendorOrderIds: Record<string, string> = {};

  for (const group of vendorGroups) {
    const result = await client.query(
      `
      INSERT INTO vendor_orders (
        order_id,
        vendor_organization_id,
        status,
        subtotal_amount_cents
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [
        orderId,
        group.vendorOrganizationId,
        'pending', // Initial status
        group.subtotalCents,
      ]
    );

    vendorOrderIds[group.vendorOrganizationId] = result.rows[0].id;
  }

  return vendorOrderIds;
}

/**
 * Creates order_items linked to vendor_orders with price snapshots
 */
export async function createOrderItems(
  client: PoolClient,
  vendorOrderIds: Record<string, string>,
  vendorGroups: VendorOrderGroup[]
): Promise<void> {
  for (const group of vendorGroups) {
    const vendorOrderId = vendorOrderIds[group.vendorOrganizationId];

    for (const item of group.items) {
      await client.query(
        `
        INSERT INTO order_items (
          vendor_order_id,
          variant_id,
          quantity,
          price_snapshot_cents,
          sku_snapshot,
          product_name_snapshot
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          vendorOrderId,
          item.variantId,
          item.quantity,
          item.priceCents,
          item.sku,
          item.productName,
        ]
      );
    }
  }
}

/**
 * Reserves inventory by decrementing stock_quantity
 * MUST be called after locking variants (FOR UPDATE)
 */
export async function reserveInventory(
  client: PoolClient,
  reservations: Array<{ variantId: string; organizationId: string; quantity: number }>
): Promise<void> {
  for (const res of reservations) {
    const result = await client.query(
      `
      UPDATE variants v
      SET stock_quantity = stock_quantity - $1
      FROM products p
      WHERE v.product_id = p.id
        AND v.id = $2
        AND p.organization_id = $3
        AND v.stock_quantity >= $1  -- Double-check stock after lock
      RETURNING v.id
      `,
      [res.quantity, res.variantId, res.organizationId]
    );

    if (result.rows.length === 0) {
      throw new Error("INVENTORY_RESERVATION_FAILED");
    }
  }
}

/**
 * Clears processed cart items after successful order creation
 */
export async function clearProcessedCartItems(
  client: PoolClient,
  userId: string,
  cartItemIds: string[]
): Promise<void> {
  if (cartItemIds.length === 0) return;

  await client.query(
    `
    DELETE FROM cart_items
    WHERE id = ANY($1::uuid[])
      AND cart_id = (SELECT id FROM carts WHERE user_id = $2)
    `,
    [cartItemIds, userId]
  );
}

// ─────────────────────────────────────────────────────────────
// 📦 ORDER CREATION TRANSACTION (Orchestrator)
// ─────────────────────────────────────────────────────────────

/**
 * Full ACID transaction for order creation
 * Handles: idempotency → lock cart → validate → reserve → create → clear cart
 */
export async function createOrderTransaction(params: {
  customerUserId: string;
  clientRequestId: string;
  paymentMethod: 'fake';
  shippingAddress: any;
  notes?: string;
}): Promise<OrderCreationResult> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Idempotency check (inside transaction for consistency)
    const existing = await checkIdempotency(params.clientRequestId, params.customerUserId);
    if (existing) {
      await client.query('ROLLBACK');
      // Return special signal for service to handle cached response
      throw new Error("ORDER_ALREADY_EXISTS");
    }

    // 2. Lock and fetch cart items
    const lockedItems = await lockCartItemsForCheckout(client, params.customerUserId);

    // 3. Group items by vendor for order splitting
    const vendorGroups: VendorOrderGroup[] = [];
    const groupsMap = new Map<string, VendorOrderGroup>();

    for (const item of lockedItems) {
      if (!groupsMap.has(item.organizationId)) {
        const group: VendorOrderGroup = {
          vendorOrganizationId: item.organizationId,
          vendorName: item.vendorName,
          items: [],
          subtotalCents: 0,
        };
        groupsMap.set(item.organizationId, group);
        vendorGroups.push(group);
      }
      const group = groupsMap.get(item.organizationId)!;
      group.items.push(item);
      group.subtotalCents += item.priceCents * item.quantity;
    }

    // 4. Calculate total
    const totalAmountCents = vendorGroups.reduce((sum, g) => sum + g.subtotalCents, 0);

    // 5. Generate order number
    const orderNumber = await generateOrderNumber(client);

    // 6. Create main order
    const orderId = await createMainOrder(client, {
      orderNumber,
      customerUserId: params.customerUserId,
      status: 'paid', // Fake payment = immediately paid
      totalAmountCents,
      clientRequestId: params.clientRequestId,
      shippingAddress: params.shippingAddress,
      notes: params.notes,
    });

    // 7. Create vendor sub-orders
    const vendorOrderIds = await createVendorOrders(client, orderId, vendorGroups);

    // 8. Create order items with snapshots
    await createOrderItems(client, vendorOrderIds, vendorGroups);

    // 9. Reserve inventory (decrement stock)
    const reservations = lockedItems.map(item => ({
      variantId: item.variantId,
      organizationId: item.organizationId,
      quantity: item.quantity,
    }));
    await reserveInventory(client, reservations);

    // 10. Clear processed cart items
    const cartItemIds = lockedItems.map(i => i.cartItemId);
    await clearProcessedCartItems(client, params.customerUserId, cartItemIds);

    await client.query('COMMIT');

    return {
      orderId,
      orderNumber,
      vendorOrderIds,
      totalAmountCents,
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// 📋 ORDER RETRIEVAL (Read-only queries)
// ─────────────────────────────────────────────────────────────

/**
 * Internal helper: Fetch full order details with vendor orders + items
 */
async function getOrderWithDetailsQuery(
  orderId: string,
  userId: string
): Promise<OrderWithDetailsResponse> {
  // Fetch main order + customer
  const orderResult = await pool.query(
    `
    SELECT 
      o.id,
      o.order_number,
      o.status,
      o.total_amount_cents,
      o.client_request_id,
      o.created_at,
      o.updated_at,
      o.shipping_address,
      o.notes,
      u.id AS customer_id,
      u.email AS customer_email
    FROM orders o
    INNER JOIN users u ON o.customer_user_id = u.id
    WHERE o.id = $1 AND o.customer_user_id = $2
    `,
    [orderId, userId]
  );

  if (orderResult.rows.length === 0) {
    throw new Error("ORDER_NOT_FOUND");
  }

  const order = orderResult.rows[0];

  // Fetch vendor orders with items
  const vendorOrdersResult = await pool.query(
    `
    SELECT 
      vo.id AS vendor_order_id,
      vo.status AS vendor_order_status,
      vo.subtotal_amount_cents,
      vo.created_at,
      vo.updated_at,
      org.id AS vendor_id,
      org.name AS vendor_name,
      org.slug AS vendor_slug,
      oi.id AS order_item_id,
      oi.quantity,
      oi.price_snapshot_cents,
      oi.sku_snapshot,
      oi.product_name_snapshot,
      v.id AS variant_id,
      v.sku AS variant_sku,
      v.name AS variant_name
    FROM vendor_orders vo
    INNER JOIN organizations org ON vo.vendor_organization_id = org.id
    LEFT JOIN order_items oi ON vo.id = oi.vendor_order_id
    LEFT JOIN variants v ON oi.variant_id = v.id
    WHERE vo.order_id = $1
    ORDER BY org.name, oi.id
    `,
    [orderId]
  );

  // Group items by vendor_order_id
  const vendorOrdersMap = new Map<string, VendorOrderWithItemsResponse>();
  for (const row of vendorOrdersResult.rows) {
    if (!vendorOrdersMap.has(row.vendor_order_id)) {
      vendorOrdersMap.set(row.vendor_order_id, {
        id: row.vendor_order_id,
        status: row.vendor_order_status,
        subtotalAmountCents: row.subtotal_amount_cents,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        vendor: {
          id: row.vendor_id,
          name: row.vendor_name,
          slug: row.vendor_slug,
        },
        items: [],
      });
    }
    if (row.order_item_id) {
      vendorOrdersMap.get(row.vendor_order_id)!.items.push({
        id: row.order_item_id,
        quantity: row.quantity,
        priceSnapshotCents: row.price_snapshot_cents,
        skuSnapshot: row.sku_snapshot,
        productNameSnapshot: row.product_name_snapshot,
        variant: {
          id: row.variant_id,
          sku: row.variant_sku,
          name: row.variant_name,
        },
      });
    }
  }

  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    totalAmountCents: order.total_amount_cents,
    clientRequestId: order.client_request_id,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    customer: {
      id: order.customer_id,
      email: order.customer_email,
    },
    shippingAddress: order.shipping_address || {},
    notes: order.notes,
    vendorOrders: Array.from(vendorOrdersMap.values()),
  };
}

/**
 * Public: Get order with details (enforces ownership)
 */
export async function getOrderWithDetails(
  orderId: string,
  userId: string
): Promise<OrderWithDetailsResponse> {
  return await getOrderWithDetailsQuery(orderId, userId);
}

/**
 * List user's orders with pagination
 */
export async function listOrders(
  userId: string,
  filters: OrderFilters
): Promise<{ orders: OrderSummaryResponse[]; total: number }> {
  // Build dynamic WHERE clause
  const conditions: string[] = ['o.customer_user_id = $1'];
  const params: any[] = [userId];
  let paramIndex = 2;

  if (filters.status) {
    conditions.push(`o.status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }
  if (filters.fromDate) {
    conditions.push(`o.created_at >= $${paramIndex}`);
    params.push(filters.fromDate);
    paramIndex++;
  }
  if (filters.toDate) {
    conditions.push(`o.created_at <= $${paramIndex}`);
    params.push(filters.toDate);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM orders o WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Pagination
  const limit = filters.limit || 20;
  const offset = ((filters.page || 1) - 1) * limit;

  // Fetch orders with summary aggregations
  const ordersResult = await pool.query(
    `
    SELECT 
      o.id,
      o.order_number,
      o.status,
      o.total_amount_cents,
      o.created_at,
      COUNT(DISTINCT vo.id) AS vendor_count,
      COUNT(oi.id) AS item_count
    FROM orders o
    LEFT JOIN vendor_orders vo ON o.id = vo.order_id
    LEFT JOIN order_items oi ON vo.id = oi.vendor_order_id
    WHERE ${whereClause}
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `,
    [...params, limit, offset]
  );

  const orders: OrderSummaryResponse[] = ordersResult.rows.map((row): OrderSummaryResponse => ({
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    totalAmountCents: row.total_amount_cents,
    createdAt: row.created_at,
    vendorCount: parseInt(row.vendor_count),
    itemCount: parseInt(row.item_count),
  }));

  return { orders, total };
}

// ─────────────────────────────────────────────────────────────
// 💰 REFUND PROCESSING (MUST be called inside transaction)
// ─────────────────────────────────────────────────────────────

/**
 * Process refund: update order status + optionally restock inventory
 */
export async function processRefund(
  client: PoolClient,
  orderId: string,
  userId: string, // support/admin user
  params: {
    reason: string;
    restockInventory: boolean;
  }
): Promise<{ restockedItems?: Array<{ variantId: string; quantity: number }> }> {
  // 1. Verify order exists and belongs to a vendor the user can manage
  // (Simplified: assume RBAC middleware already checked permissions)
  
  // 2. Fetch order items for potential restocking
  let restockedItems: Array<{ variantId: string; quantity: number }> | undefined;

  if (params.restockInventory) {
    const itemsResult = await client.query(
      `
      SELECT oi.variant_id, oi.quantity, p.organization_id
      FROM order_items oi
      INNER JOIN vendor_orders vo ON oi.vendor_order_id = vo.id
      INNER JOIN products p ON oi.variant_id = p.id
      WHERE vo.order_id = $1
      `,
      [orderId]
    );

    // 3. Restock each variant (with tenant isolation)
    restockedItems = [];
    for (const row of itemsResult.rows) {
      await client.query(
        `
        UPDATE variants v
        SET stock_quantity = stock_quantity + $1
        FROM products p
        WHERE v.product_id = p.id
          AND v.id = $2
          AND p.organization_id = $3
        `,
        [row.quantity, row.variant_id, row.organization_id]
      );
      restockedItems.push({
        variantId: row.variant_id,
        quantity: row.quantity,
      });
    }
  }

  // 4. Update main order status to 'cancelled' (or add separate refund status)
  await client.query(
    `
    UPDATE orders 
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = $1
    `,
    [orderId]
  );

  // 5. Update all vendor_orders status
  await client.query(
    `
    UPDATE vendor_orders
    SET status = 'refunded', updated_at = NOW()
    WHERE order_id = $1
    `,
    [orderId]
  );

  return { restockedItems };
}
export async function cancelOrderByCustomerTransaction(
  orderId: string,
  customerUserId: string
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 🔒 Lock order row
    const orderResult = await client.query(
      `
      SELECT id, status, customer_user_id, total_amount_cents
      FROM orders
      WHERE id = $1
      FOR UPDATE
      `,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error("ORDER_NOT_FOUND");
    }

    const order = orderResult.rows[0];

    // 🔐 تأكد أن الطلب لهذا المستخدم
    if (order.customer_user_id !== customerUserId) {
      throw new Error("ORDER_NOT_OWNED");
    }

    // ❌ إذا كان مشحون
    if (order.status === "shipped") {
      throw new Error("ORDER_ALREADY_SHIPPED");
    }

    // ❌ إذا كان ملغى
    if (order.status === "cancelled") {
      throw new Error("ORDER_ALREADY_CANCELLED");
    }

    // ✅ تحديث الحالة
    await client.query(
      `
      UPDATE orders
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE id = $1
      `,
      [orderId]
    );

    // 🔁 هنا ممكن تضيف منطق إعادة المخزون إذا موجود عندك
    // مثال:
    // await restoreInventory(client, orderId);

    await client.query("COMMIT");

    return {
      orderId,
      status: "cancelled",
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}