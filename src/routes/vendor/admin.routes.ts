import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { rbacMiddleware } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  getVendorStatisticsSchema,
  listVendorUsersSchema,
} from "../../validations/vendor-admin.validation";
import {
  getVendorStatisticsController,
  listVendorUsersController,
} from "../../controllers/vendor-admin.controller";

const router = Router();

// ✅ كل الـ routes تحت /vendor محمية بـ auth + rbac
router.use(authMiddleware);
router.use(rbacMiddleware(['vendor_admin', 'vendor_staff']));

// ── Statistics ──────────────────────────────────────────────
router.get(
  "/statistics",
  validate(getVendorStatisticsSchema),
  getVendorStatisticsController
);

// ── User Management ─────────────────────────────────────────
router.get(
  "/users",
  validate(listVendorUsersSchema),
  listVendorUsersController
);

export default router;