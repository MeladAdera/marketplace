// src/controllers/inventory.controller.ts
import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { asyncHandler } from "../middlewares/errorHandler.middleware";
import {
  UnauthorizedError,
  ForbiddenError,
  NoOrganizationError
} from "../errors";

import {
  updateStockService,
  getInventoryHistoryService,
  checkStockAvailabilityService
} from "../services/inventory.service";

/**
 * 1️⃣ PATCH /vendor/inventory/:variantId
 * Update stock quantity for a variant
 */
export const updateStockController = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  // Only vendor_admin can update inventory (you can allow vendor_staff too if needed)
  if (!['vendor_admin', 'vendor_staff'].includes(req.user.role)) {
    throw new ForbiddenError('Insufficient permissions to update inventory');
  }

  if (!req.user.organization_id) {
    throw new NoOrganizationError();
  }

  const variantId = req.params.variantId as string;
  const { quantity, reason } = req.body;

  const result = await updateStockService(
    req.user.organization_id,
    req.user.id,
    {
      variantId,
      quantity,
      reason
    }
  );

  return res.status(200).json({
    success: true,
    message: req.t('stock_updated', { ns: 'inventory' }),
    data: {
      variantId: result.variantId,
      oldStock: result.oldStock,
      newStock: result.newStock,
      change: result.change
    }
  });
});

/**
 * 2️⃣ GET /vendor/inventory/history
 * Get inventory movement history
 */
export const getInventoryHistoryController = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  if (!['vendor_admin', 'vendor_staff'].includes(req.user.role)) {
    throw new ForbiddenError('Insufficient permissions to view inventory history');
  }

  if (!req.user.organization_id) {
    throw new NoOrganizationError();
  }

  const { page, limit, variantId } = req.query;

  const result = await getInventoryHistoryService(
    req.user.organization_id,
    variantId as string | undefined,
    page as unknown as number,
    limit as unknown as number
  );

  return res.status(200).json({
    success: true,
    message: req.t('history_retrieved', { ns: 'inventory' }),
    data: result
  });
});

/**
 * 3️⃣ GET /vendor/inventory/check
 * Check stock availability (useful for cart validation)
 */
export const checkStockController = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  if (!req.user.organization_id) {
    throw new NoOrganizationError();
  }

  const { variantId, quantity } = req.query;

  const result = await checkStockAvailabilityService(
    req.user.organization_id,
    variantId as string,
    quantity as unknown as number
  );

  return res.status(200).json({
    success: true,
    message: req.t('stock_checked', { ns: 'inventory' }),
    data: result
  });
});