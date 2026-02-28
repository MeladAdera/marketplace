// src/routes/order.routes.ts
import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  checkoutController,
  listOrdersController,
  getOrderController,
  refundOrderController,
  cancelOrderController,
} from "../controllers/order.controller";
import {
  checkoutSchema,
  listOrdersSchema,
  getOrderParamsSchema,
  refundParamsSchema,
  refundSchema,
} from "../validations/order.validation";
import { rbacMiddleware } from "../middlewares/rbac.middleware";

const router = Router();

// All order routes require authentication
router.use(authMiddleware);

/**
 * POST /orders
 * Create order from cart (checkout)
 */
router.post(
  "/",
  validate({ body: checkoutSchema }),
  checkoutController
);

/**
 * GET /orders
 * List user's orders with pagination
 */
router.get(
  "/",
  validate(listOrdersSchema),
  listOrdersController
);


/**
 * GET /orders/:id
 * Get single order details
 */
router.get(
  "/:id",
  validate({ params: getOrderParamsSchema }),
  getOrderController
);

/**
 * POST /orders/:id/refund
 * Process refund (Admin/Support only)
 * Note: Add RBAC middleware here to restrict to admin/support roles
 */
router.post(
  "/:id/refund",
  validate({ params: refundParamsSchema }),
  rbacMiddleware(["support", "platform_admin"]),
  validate({ body: refundSchema }),
  refundOrderController
);
router.post(
  "/:id/cancel",
  validate({ params: getOrderParamsSchema }),
  cancelOrderController
);

export default router;