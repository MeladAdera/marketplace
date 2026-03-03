import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { rbacMiddleware } from "../../middlewares/rbac.middleware";
import {
  listVendorOrdersController,
  getVendorOrderController,
  updateVendorOrderStatusController,
} from "../../controllers/vendor-admin.controller";

const router = Router();

// ✅ كل الـ routes تحت /vendor محمية بـ auth + rbac
router.use(authMiddleware);
router.use(rbacMiddleware(['vendor_admin', 'vendor_staff']));

router.get("/orders", listVendorOrdersController);
router.get("/orders/:id", getVendorOrderController);
router.patch("/orders/:id/status", updateVendorOrderStatusController);

export default router;