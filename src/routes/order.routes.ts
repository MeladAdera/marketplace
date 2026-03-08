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

// ✅ استيرادات النظام الجديد
import { authorize } from "../middlewares/authorize.middleware";
import { Permission } from "../constants/permissions";

import { Router } from "express";
const router = Router();

router.use(authMiddleware); 

/* =====================================================
   👤 CUSTOMER ROUTES
   Base: /orders
===================================================== */

router.post(
  "/",
  authorize(Permission.ORDER_CREATE),
  validate({ body: checkoutSchema }),
  checkoutController
);

router.get(
  "/",
  authorize(Permission.ORDER_READ),
  validate(listOrdersSchema),
  listOrdersController
);

router.get(
  "/:id",
  authorize(Permission.ORDER_READ),
  validate({ params: getOrderParamsSchema }),
  getOrderController
);

router.post(
  "/:id/cancel",
  authorize(Permission.ORDER_UPDATE),
  validate({ params: getOrderParamsSchema }),
  cancelOrderController
);

/* =====================================================
   🛠 PLATFORM ADMIN ROUTES
   Base: /orders/admin
===================================================== */

router.post(
  "/admin/:id/refund",
  authorize(Permission.ORDER_REFUND),
  validate({ params: refundParamsSchema }),
  validate({ body: refundSchema }),
  refundOrderController
);

export default router;