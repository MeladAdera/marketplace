// src/services/order.service.ts
import {
  cancelOrderByCustomerTransaction,
  checkIdempotency,
  createOrderTransaction,
  getOrderWithDetails,
  listOrders,
  processRefund,
} from "../repository/order.repo";
import {
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
// 🔹 CHECKOUT SERVICE
// ─────────────────────────────────────────────────────────────

export async function checkoutService(
  userId: string,
  input: CheckoutRequest,
  t?: (key: string, params?: any) => string
): Promise<CheckoutResponse> {
  try {
    const result = await createOrderTransaction({
      customerUserId: userId,
      clientRequestId: input.client_request_id,
      paymentMethod: input.payment_method,
      shippingAddress: input.shipping_address,
      notes: input.notes,
    });

    const orderDetails = await getOrderWithDetails(result.orderId, userId);

    // ✅ Audit logs (non-blocking)
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
    if (error.message === "ORDER_ALREADY_EXISTS") {
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
      // ✅ FIXED: Pass object instead of string
      throw new ValidationError(
        t?.("cart.empty", { ns: "errors" }) || "Your cart is empty",
        { field: "cart", code: "empty" }
      );
    }

    if (error.message === "INSUFFICIENT_STOCK") {
      // ✅ FIXED: Pass object instead of string
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

    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// 🔹 GET ORDER SERVICE
// ─────────────────────────────────────────────────────────────

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
// 🔹 LIST ORDERS SERVICE
// ─────────────────────────────────────────────────────────────

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
  const page = filters.page || 1;
  const limit = filters.limit || 20;

  const { orders, total } = await listOrders(userId, {
    customerUserId: userId,
    status: filters.status as any,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    page,
    limit,
  });

  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    data: {
      orders,
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
// 🔹 REFUND SERVICE
// ─────────────────────────────────────────────────────────────

export async function refundOrderService(
  orderId: string,
  adminUserId: string,
  input: RefundRequest,
  t?: (key: string, params?: any) => string
): Promise<RefundResponse> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

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

    if (order.status === "cancelled") {
      await client.query("ROLLBACK");
      // ✅ FIXED: Pass object instead of string
      throw new ValidationError(
        t?.("order.already_cancelled", { ns: "errors" }) || "Order already cancelled",
        { field: "status", code: "invalid_state" }
      );
    }

    const result = await processRefund(client, orderId, adminUserId, {
      reason: input.reason.trim(),
      restockInventory: input.restock_inventory ?? true,
    });

    await client.query("COMMIT");

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
// ─────────────────────────────────────────────────────────────
// 🔹 CUSTOMER CANCEL ORDER SERVICE
// ─────────────────────────────────────────────────────────────

export async function cancelOrderByCustomerService(
  orderId: string,
  userId: string,
  t?: (key: string, params?: any) => string
): Promise<{
  success: true;
  data: { orderId: string; status: string };
}> {
  try {
    // Execute repository transaction
  await cancelOrderByCustomerTransaction(orderId, userId);

    // Audit log (non-blocking)
    await AuditService.log({
      actorUserId: userId,
      action: "ORDER_CANCELLED_BY_CUSTOMER",
      entityType: "order",
      entityId: orderId,
      newValues: {
        status: "cancelled",
      },
    }).catch((err: Error) => console.error("Audit log failed:", err));

    return {
      success: true,
      data: {
        orderId,
        status: "cancelled",
      },
    };

  } catch (error: any) {

    if (error.message === "ORDER_NOT_FOUND") {
      throw new NotFoundError(
        t?.("order.not_found", { ns: "errors" }) || "Order not found"
      );
    }

    if (error.message === "ORDER_ALREADY_SHIPPED") {
      throw new ValidationError(
        t?.("order.already_shipped", { ns: "errors" }) ||
          "Order cannot be cancelled after shipment",
        { field: "status", code: "invalid_state" }
      );
    }

    if (error.message === "ORDER_ALREADY_CANCELLED") {
      throw new ValidationError(
        t?.("order.already_cancelled", { ns: "errors" }) ||
          "Order already cancelled",
        { field: "status", code: "invalid_state" }
      );
    }

    throw error;
  }
}