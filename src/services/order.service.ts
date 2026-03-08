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

// ─────────────────────────────────────────
// CHECKOUT SERVICE
// ─────────────────────────────────────────

export async function checkoutService(
  userId: string,
  input: CheckoutRequest
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
    }).catch(console.error);

    return {
      success: true,
      data: orderDetails,
      message: "order.created",
    };

  } catch (error: any) {

    if (error.message === "ORDER_ALREADY_EXISTS") {

      const existingOrder = await checkIdempotency(input.client_request_id, userId);

      if (existingOrder) {
        return {
          success: true,
          data: existingOrder,
          message: "order.already_exists",
        };
      }

      throw new ConflictError("order.duplicate_request");
    }

    if (error.message === "CART_EMPTY") {
      throw new ValidationError(
        "cart.empty",
        undefined,
        { field: "cart", code: "empty" }
      );
    }

    if (error.message === "INSUFFICIENT_STOCK") {
      throw new ValidationError(
        "inventory.insufficient_stock",
        undefined,
        { field: "items", code: "insufficient_stock" }
      );
    }

    if (error.message === "INVENTORY_RESERVATION_FAILED") {
      throw new InternalServerError("inventory.reservation_failed");
    }

    throw error;
  }
}

// ─────────────────────────────────────────
// GET ORDER
// ─────────────────────────────────────────

export async function getOrderService(
  orderId: string,
  userId: string
): Promise<{ success: true; data: OrderWithDetailsResponse }> {

  try {

    const order = await getOrderWithDetails(orderId, userId);

    return {
      success: true,
      data: order,
    };

  } catch (error: any) {

    if (error.message === "ORDER_NOT_FOUND") {
      throw new NotFoundError("order.not_found");
    }

    throw error;
  }
}

// ─────────────────────────────────────────
// LIST ORDERS
// ─────────────────────────────────────────

export async function listOrdersService(
  userId: string,
  filters: {
    status?: string;
    fromDate?: Date;
    toDate?: Date;
    page?: number;
    limit?: number;
  }
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

// ─────────────────────────────────────────
// REFUND ORDER
// ─────────────────────────────────────────

export async function refundOrderService(
  orderId: string,
  adminUserId: string,
  input: RefundRequest
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
      throw new NotFoundError("order.not_found");
    }

    const order = orderCheck.rows[0];

    if (order.status === "cancelled") {
      await client.query("ROLLBACK");

      throw new ValidationError(
        "order.already_cancelled",
        undefined,
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
    }).catch(console.error);

    return {
      success: true,
      data: {
        orderId,
        refundProcessed: true,
        restockedItems: result.restockedItems,
        message: "order.refund_processed",
      },
    };

  } catch (error: any) {

    await client.query("ROLLBACK");

    if (error.message === "ORDER_NOT_FOUND") {
      throw new NotFoundError("order.not_found");
    }

    throw error;

  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────
// CUSTOMER CANCEL ORDER
// ─────────────────────────────────────────

export async function cancelOrderByCustomerService(
  orderId: string,
  userId: string
) {

  try {

    await cancelOrderByCustomerTransaction(orderId, userId);

    await AuditService.log({
      actorUserId: userId,
      action: "ORDER_CANCELLED_BY_CUSTOMER",
      entityType: "order",
      entityId: orderId,
    }).catch(console.error);

    return {
      success: true,
      data: {
        orderId,
        status: "cancelled",
      },
    };

  } catch (error: any) {

    if (error.message === "ORDER_NOT_FOUND") {
      throw new NotFoundError("order.not_found");
    }

    if (error.message === "ORDER_ALREADY_SHIPPED") {
      throw new ValidationError(
        "order.already_shipped",
        undefined,
        { field: "status", code: "invalid_state" }
      );
    }

    if (error.message === "ORDER_ALREADY_CANCELLED") {
      throw new ValidationError(
        "order.already_cancelled",
        undefined,
        { field: "status", code: "invalid_state" }
      );
    }

    throw error;
  }
}