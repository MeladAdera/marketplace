// src/routes/order.routes.ts
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
import { Router } from "express";
const router = Router();
router.use(authMiddleware); 

/* =====================================================
   👤 CUSTOMER ROUTES
   Base: /orders
===================================================== */

router.post(
  "/",
  rbacMiddleware(["customer"]),
  validate({ body: checkoutSchema }),
  checkoutController
);

router.get(
  "/",
  rbacMiddleware(["customer"]),
  validate(listOrdersSchema),
  listOrdersController
);

router.get(
  "/:id",
  rbacMiddleware(["customer"]),
  validate({ params: getOrderParamsSchema }),
  getOrderController
);

router.post(
  "/:id/cancel",
  rbacMiddleware(["customer"]),
  validate({ params: getOrderParamsSchema }),
  cancelOrderController
);

/* =====================================================
   🛠 PLATFORM ADMIN ROUTES
   Base: /orders/admin
===================================================== */

router.post(
  "/admin/:id/refund",
  rbacMiddleware(["platform_admin", "support"]),
  validate({ params: refundParamsSchema }),
  validate({ body: refundSchema }),
  refundOrderController
);

export default router;