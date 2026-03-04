import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { rbacMiddleware } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { updateOrderStatusSchema } from "../../validations/vendor-order.validation";
import {
  listVendorOrdersController,
  getVendorOrderController,
  updateVendorOrderStatusController,
} from "../../controllers/vendor-order.controller";

const router = Router();

router.use(authMiddleware);
router.use(rbacMiddleware(['vendor_admin', 'vendor_staff']));

router.get("/orders", listVendorOrdersController);
router.get("/orders/:id", getVendorOrderController);

// ✅ NEW: Update order status with validation
router.patch(
  "/orders/:id/status",
  validate(updateOrderStatusSchema),
  updateVendorOrderStatusController
);

export default router;