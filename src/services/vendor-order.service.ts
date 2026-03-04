import {
  findVendorOrdersByOrgId,
  findVendorOrderById,
  updateVendorOrderStatus,
} from "../repository/vendor-orders.repo";
import {
  VendorOrderSummary,
  VendorOrderFilters,
  VendorOrderListResponse,
  VendorOrderDetailResponse,
  UpdateOrderStatusInput,
} from "../types/vendor-admin.types";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "../errors/AppError";
import { AuditService } from "./audit.service";

// ─────────────────────────────────────────────────────────────
// 🔹 LIST VENDOR ORDERS (GET /vendor/orders)
// ─────────────────────────────────────────────────────────────

export async function listVendorOrdersService(
  organizationId: string,
  filters: VendorOrderFilters,
  t?: (key: string, params?: any) => string
): Promise<VendorOrderListResponse> {
  
  // ✅ Validate pagination params
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 20)); // Cap at 100 to prevent abuse

  const { orders, total } = await findVendorOrdersByOrgId(organizationId, {
    ...filters,
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
// 🔹 GET SINGLE VENDOR ORDER (GET /vendor/orders/:id)
// ─────────────────────────────────────────────────────────────

export async function getVendorOrderService(
  orderId: string,
  organizationId: string,
  t?: (key: string, params?: any) => string
): Promise<{ success: true; data: VendorOrderDetailResponse }> {
  
  const order = await findVendorOrderById(orderId, organizationId);

  if (!order) {
    throw new NotFoundError(
      t?.("vendor.order_not_found", { ns: "errors" }) || "Order not found in your store"
    );
  }

  return {
    success: true,
    data: order,
  };
}

// ─────────────────────────────────────────────────────────────
// 🔹 UPDATE ORDER STATUS (PATCH /vendor/orders/:id/status)
// ─────────────────────────────────────────────────────────────

export async function updateVendorOrderStatusService(
  orderId: string,
  organizationId: string,
  input: UpdateOrderStatusInput,
  actorUserId: string,
  t?: (key: string, params?: any) => string
): Promise<{ success: true; data: { orderId: string; newStatus: string } }> {
  
  // ✅ Define allowed status transitions (State Machine)
  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    'pending': ['accepted', 'cancelled'],
    'accepted': ['packed', 'cancelled'],
    'packed': ['shipped', 'cancelled'],
    'shipped': ['delivered'],
    'delivered': [], // Terminal state
    'cancelled': [], // Terminal state
    'refunded': [],  // Terminal state
  };

  // 1) Fetch current order to validate transition
  const currentOrder = await findVendorOrderById(orderId, organizationId);
  
  if (!currentOrder) {
    throw new NotFoundError(
      t?.("vendor.order_not_found", { ns: "errors" }) || "Order not found in your store"
    );
  }

  // 2) Validate state transition
  const allowedNextStates = ALLOWED_TRANSITIONS[currentOrder.status];
  if (!allowedNextStates || !allowedNextStates.includes(input.newStatus)) {
    throw new ValidationError(
      t?.("vendor.invalid_status_transition", { 
        ns: "errors", 
        params: { from: currentOrder.status, to: input.newStatus } 
      }) || `Cannot transition from '${currentOrder.status}' to '${input.newStatus}'`,
      { field: "status", code: "invalid_transition" }
    );
  }

  // 3) Prevent cancelling delivered orders
  if (currentOrder.status === 'delivered' && input.newStatus === 'cancelled') {
    throw new ValidationError(
      t?.("vendor.cannot_cancel_delivered", { ns: "errors" }) || "Cannot cancel a delivered order",
      { field: "status", code: "invalid_state" }
    );
  }

  // 4) Execute update (with audit logging inside repo)
  const updatedOrder = await updateVendorOrderStatus(
    orderId,
    organizationId,
    input.newStatus,
    actorUserId,
    input.note
  );

  // 5) Log the action (non-blocking)
  await AuditService.log({
    actorUserId,
    organizationId,
    action: "VENDOR_ORDER_STATUS_UPDATED",
    entityType: "vendor_order",
    entityId: orderId,
    oldValues: { status: currentOrder.status },
    newValues: { status: input.newStatus, note: input.note },
    metadata: {
      orderNumber: currentOrder.orderNumber,
      previousStatus: currentOrder.status,
      newStatus: input.newStatus,
    },
  }).catch((err: Error) => console.error("Audit log failed:", err));

  return {
    success: true,
    data: {
      orderId,
      newStatus: input.newStatus,
    },
  };
}
