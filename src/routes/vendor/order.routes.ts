// src/routes/vendor/vendor-order.routes.ts
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { updateOrderStatusSchema } from "../../validations/vendor-order.validation";
import {
  listVendorOrdersController,
  getVendorOrderController,
  updateVendorOrderStatusController,
} from "../../controllers/vendor-order.controller";

import { authorize } from "../../middlewares/authorize.middleware";
import { Permission } from "../../constants/permissions";

const router = Router();

router.use(authMiddleware);

// ── List & Read Orders ──────────────────────────────────────
router.get(
  "/orders",
  authorize(Permission.ORDER_READ),
  listVendorOrdersController
);

router.get(
  "/orders/:id",
  authorize(Permission.ORDER_READ),
  getVendorOrderController
);


router.patch(
  "/orders/:id/status",
  authorize(Permission.ORDER_UPDATE),
  validate(updateOrderStatusSchema),
  updateVendorOrderStatusController
);

export default router;