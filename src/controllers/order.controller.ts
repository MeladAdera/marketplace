// src/controllers/order.controller.ts
import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/errorHandler.middleware";
import { AuthRequest } from "../middlewares/auth.middleware";

import {
  cancelOrderByCustomerService,
  checkoutService,
  getOrderService,
  listOrdersService,
  refundOrderService,
} from "../services/order.service";

/**
 * POST /orders
 * Create order from cart (checkout)
 */
export const checkoutController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const result = await checkoutService(userId, req.body);

  return res.status(201).json(result);
});

/**
 * GET /orders
 * List current user's orders with pagination
 */
export const listOrdersController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const filters = {
    status: req.query.status as string | undefined,
    fromDate: req.query.from_date ? new Date(req.query.from_date as string) : undefined,
    toDate: req.query.to_date ? new Date(req.query.to_date as string) : undefined,
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
  };

  const result = await listOrdersService(userId, filters);

  return res.status(200).json(result);
});

/**
 * GET /orders/:id
 * Get single order with full details
 */
export const getOrderController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params as { id: string };

  const result = await getOrderService(id, userId);

  return res.status(200).json(result);
});

/**
 * POST /orders/:id/refund
 * Process refund (Admin/Support only)
 */
export const refundOrderController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const adminUserId = req.user!.id;
  const { id } = req.params as { id: string };

  const result = await refundOrderService(id, adminUserId, req.body);

  return res.status(200).json(result);
});

/**
 * POST /orders/:id/cancel
 * Customer cancels their own order
 */
export const cancelOrderController = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };

    const result = await cancelOrderByCustomerService(id, userId);

    return res.status(200).json(result);
  }
);