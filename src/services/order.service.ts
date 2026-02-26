// src/services/order.service.ts
import {
  // Repository functions
  checkIdempotency,
  createOrderTransaction,
  getOrderWithDetails,
  listOrders,
  processRefund,
} from "../repository/order.repo";
import {
  // API Request/Response Types
  CheckoutRequest,
  CheckoutResponse,
  OrderWithDetailsResponse,
  OrderListResponse,
  RefundRequest,
  RefundResponse,
} from "../types/order.types";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  InternalServerError,
} from "../errors/AppError";
import { AuditService } from "./audit.service";
import pool from "../db/database";

// ─────────────────────────────────────────────────────────────
// 🔹 CHECKOUT SERVICE (Main checkout flow)
// ─────────────────────────────────────────────────────────────

/**
 * Service: Process checkout and create order
 * @throws {ValidationError} if cart empty or insufficient stock
 * @throws {ConflictError} if duplicate client_request_id (returns existing order)
 * 
 * ✅ NOTE: All syntax validation (UUID, required fields, etc.) is handled by Zod middleware
 */
export async function checkoutService(
  userId: string,
  input: CheckoutRequest,
  t?: (key: string, params?: any) => string
): Promise<CheckoutResponse> {
  try {
    // 1. Execute transactional order creation
    const result = await createOrderTransaction({
      customerUserId: userId,
      clientRequestId: input.client_request_id,
      paymentMethod: input.payment_method,
      shippingAddress: input.shipping_address,
      notes: input.notes,
    });

    // 2. Fetch full order details for response
    const orderDetails = await getOrderWithDetails(result.orderId, userId);

    // 3. 📝 Log audit (non-blocking)
    await AuditService.log({
      actorUserId: userId,
      action: "ORDER_CREATED",
      entityType: "order",
      entityId: result.orderId,
      newValues: {
        orderNumber: result.orderNumber,
        totalAmountCents: result.totalAmountCents,
        vendorOrderIds: result.vendorOrderIds,
        clientRequestId: input.client_request_id,
      },
      metadata: {
        paymentMethod: input.payment_method,
        vendorCount: Object.keys(result.vendorOrderIds).length,
      },
    }).catch((err: Error) => console.error("Audit log failed:", err));

    // 4. Log inventory reservations (non-blocking)
    await AuditService.log({
      actorUserId: userId,
      action: "INVENTORY_RESERVED",
      entityType: "inventory",
      metadata: {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
      },
    }).catch((err: Error) => console.error("Audit log failed:", err));

    return {
      success: true,
      data: orderDetails,
      message: t?.("order.created", { ns: "product" }) || "Order placed successfully",
    };

  } catch (error: any) {
    // ─────────────────────────────────────────────────────────
    // 🎯 BUSINESS LOGIC ERRORS ONLY (No syntax validation here)
    // ─────────────────────────────────────────────────────────
    
    if (error.message === "ORDER_ALREADY_EXISTS") {
      // Idempotent response: fetch and return existing order
      const existingOrder = await checkIdempotency(input.client_request_id, userId);
      
      if (existingOrder) {
        return {
          success: true,
          data: existingOrder,
          message: t?.("order.already_exists", { ns: "product" }) || "Order already exists (idempotent response)",
        };
      }
      
      throw new ConflictError(
        t?.("order.duplicate_request", { ns: "errors" }) || "Duplicate order request"
      );
    }

    if (error.message === "CART_EMPTY") {
      throw new ValidationError(
        t?.("cart.empty", { ns: "errors" }) || "Your cart is empty",
        { field: "cart", code: "empty" }
      );
    }

    if (error.message === "INSUFFICIENT_STOCK") {
      throw new ValidationError(
        t?.("inventory.insufficient_stock", { ns: "errors" }) || "One or more items are out of stock",
        { field: "items", code: "insufficient_stock" }
      );
    }

    if (error.message === "INVENTORY_RESERVATION_FAILED") {
      throw new InternalServerError(
        t?.("inventory.reservation_failed", { ns: "errors" }) || "Failed to reserve inventory. Please try again."
      );
    }

    // Re-throw unknown errors
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// 🔹 GET ORDER SERVICE (Single order details)
// ─────────────────────────────────────────────────────────────

/**
 * Service: Get single order with full details
 * @throws {NotFoundError} if order not found or not owned by user
 * 
 * ✅ NOTE: UUID validation is handled by Zod middleware
 */
export async function getOrderService(
  orderId: string,
  userId: string,
  t?: (key: string, params?: any) => string
): Promise<{ success: true; data: OrderWithDetailsResponse }> {
  try {
    const order = await getOrderWithDetails(orderId, userId);

    return {
      success: true,
      data: order,
    };

  } catch (error: any) {
    if (error.message === "ORDER_NOT_FOUND") {
      throw new NotFoundError(
        t?.("order.not_found", { ns: "errors" }) || "Order not found"
      );
    }

    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// 🔹 LIST ORDERS SERVICE (Paginated list)
// ─────────────────────────────────────────────────────────────

/**
 * Service: List user's orders with pagination
 * 
 * ✅ NOTE: Pagination & date validation is handled by Zod middleware
 */
export async function listOrdersService(
  userId: string,
  filters: {
    status?: string;
    fromDate?: Date;
    toDate?: Date;
    page?: number;
    limit?: number;
  },
  t?: (key: string, params?: any) => string
): Promise<OrderListResponse> {
  const { orders, total } = await listOrders(userId, {
    customerUserId: userId,
    status: filters.status as any,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    page: filters.page || 1,
    limit: filters.limit || 20,
  });

  const totalPages = Math.ceil(total / (filters.limit || 20));

  return {
    success: true,
    data: {
      orders,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 20,
        total,
        totalPages,
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// 🔹 REFUND SERVICE (Admin/Support only)
// ─────────────────────────────────────────────────────────────

/**
 * Service: Process refund for an order
 * @throws {NotFoundError} if order not found
 * @throws {ValidationError} if order already refunded
 * 
 * ✅ NOTE: UUID & reason format validation is handled by Zod middleware
 */
export async function refundOrderService(
  orderId: string,
  adminUserId: string,
  input: RefundRequest,
  t?: (key: string, params?: any) => string
): Promise<RefundResponse> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Verify order exists and is eligible for refund
    const orderCheck = await client.query(
      `
      SELECT id, status, customer_user_id, total_amount_cents
      FROM orders
      WHERE id = $1
      FOR UPDATE
      `,
      [orderId]
    );

    if (orderCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new NotFoundError(
        t?.("order.not_found", { ns: "errors" }) || "Order not found"
      );
    }

    const order = orderCheck.rows[0];

    // 2. 🎯 BUSINESS RULE: Check if already refunded/cancelled
    if (order.status === "cancelled") {
      await client.query("ROLLBACK");
      throw new ValidationError(
        t?.("order.already_cancelled", { ns: "errors" }) || "Order already cancelled",
        { field: "status", code: "invalid_state" }
      );
    }

    // 3. Process refund (update order + optionally restock)
    const result = await processRefund(client, orderId, adminUserId, {
      reason: input.reason.trim(),
      restockInventory: input.restock_inventory ?? true,
    });

    await client.query("COMMIT");

    // 4. 📝 Log audit (non-blocking)
    await AuditService.log({
      actorUserId: adminUserId,
      action: "ORDER_REFUNDED",
      entityType: "order",
      entityId: orderId,
      newValues: {
        status: "cancelled",
        refundReason: input.reason.trim(),
        restockedInventory: input.restock_inventory ?? true,
      },
      metadata: {
        originalAmountCents: order.total_amount_cents,
        restockedItems: result.restockedItems,
      },
    }).catch((err: Error) => console.error("Audit log failed:", err));

    return {
      success: true,
      data: {
        orderId,
        refundProcessed: true,
        restockedItems: result.restockedItems,
        message: t?.("order.refund_processed", { ns: "product" }) || "Refund processed successfully",
      },
    };

  } catch (error: any) {
    await client.query("ROLLBACK");

    if (error.message === "ORDER_NOT_FOUND") {
      throw new NotFoundError(
        t?.("order.not_found", { ns: "errors" }) || "Order not found"
      );
    }

    throw error;
  } finally {
    client.release();
  }
}