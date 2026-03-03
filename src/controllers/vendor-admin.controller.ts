import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/errorHandler.middleware";
import { AuthRequest } from "../middlewares/auth.middleware";
import {
  listVendorOrdersService,
  getVendorOrderService,
  updateVendorOrderStatusService,
} from "../services/vendor-admin.service";
import { VendorOrderStatus } from "../types/order.types"; // ✅ استورد النوع

// ─────────────────────────────────────────────────────────────
// 🔹 TYPE GUARD: تحقق أن القيمة من VendorOrderStatus
// ─────────────────────────────────────────────────────────────
function isValidVendorOrderStatus(value: string | undefined): value is VendorOrderStatus {
  const validStatuses: VendorOrderStatus[] = [
    'pending', 'accepted', 'packed', 'shipped', 
    'delivered', 'cancelled', 'refunded'
  ];
  return value !== undefined && validStatuses.includes(value as VendorOrderStatus);
}

/**
 * GET /vendor/orders
 * List all orders for this vendor's organization
 */
export const listVendorOrdersController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organization_id!;
    const t = req.t;

    // ✅ Extract query params
    const rawStatus = req.query.status as string | undefined;
    
    // ✅ Validate status using type guard
    const status = isValidVendorOrderStatus(rawStatus) ? rawStatus : undefined;

    const filters = {
      status, // ✅ الآن نوعه VendorOrderStatus | undefined
      fromDate: req.query.from_date
        ? new Date(req.query.from_date as string)
        : undefined,
      toDate: req.query.to_date
        ? new Date(req.query.to_date as string)
        : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await listVendorOrdersService(organizationId, filters, t);

    return res.status(200).json(result);
  }
);

/**
 * GET /vendor/orders/:id
 * Get single vendor order details
 */
export const getVendorOrderController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organization_id!;
    const t = req.t;
    const { id } = req.params as { id: string };

    const result = await getVendorOrderService(id, organizationId, t);

    return res.status(200).json(result);
  }
);

/**
 * PATCH /vendor/orders/:id/status
 * Update order status (with state machine validation)
 */
export const updateVendorOrderStatusController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organization_id!;
    const actorUserId = req.user!.id;
    const t = req.t;
    const { id } = req.params as { id: string };

    const result = await updateVendorOrderStatusService(
      id,
      organizationId,
      req.body,
      actorUserId,
      t
    );

    return res.status(200).json(result);
  }
);