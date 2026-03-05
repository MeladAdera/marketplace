import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { rbacMiddleware } from "../../middlewares/rbac.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  // ✅ استيراد الـ Validation Schemas
  getVendorUserSchema,
  blockUserSchema,  // ✅ الجديد
  getVendorStatisticsSchema,
  listVendorUsersSchema,
  updateUserRoleSchema,
} from "../../validations/vendor-admin.validation";
import {
  // ✅ استيراد الـ Controllers
  getVendorUserController,
  blockVendorUserController,  // ✅ الجديد
  getVendorStatisticsController,
  listVendorUsersController,
  updateVendorUserRoleController,
} from "../../controllers/vendor-admin.controller";

const router = Router();

// ✅ Auth + RBAC
router.use(authMiddleware);

// ── Read Operations (Admin + Staff) ─────────────────────────
router.use(rbacMiddleware(['vendor_admin', 'vendor_staff']));

router.get("/statistics", validate(getVendorStatisticsSchema), getVendorStatisticsController);
router.get("/users", validate(listVendorUsersSchema), listVendorUsersController);
router.get("/users/:id", validate(getVendorUserSchema), getVendorUserController);

// ── Write Operations (Admin Only) ───────────────────────────
router.use(rbacMiddleware(['vendor_admin']));  // ✅ Elevate to admin-only

// ✅ NEW: Block/Unblock User
router.patch(
  "/users/:id/block",
  validate(blockUserSchema),
  blockVendorUserController
);
// ✅ NEW: Change User Role (Downgrade only)
router.patch(
  "/users/:id/role",
  validate(updateUserRoleSchema),
  updateVendorUserRoleController
);

export default router;