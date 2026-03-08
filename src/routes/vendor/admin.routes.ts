// src/routes/vendor/vendor-admin.routes.ts
// Vendor Admin Routes - Using new Permission-based Authorization

import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  getVendorUserSchema,
  blockUserSchema,
  getVendorStatisticsSchema,
  listVendorUsersSchema,
  updateUserRoleSchema,
} from "../../validations/vendor-admin.validation";
import {
  getVendorUserController,
  blockVendorUserController,
  getVendorStatisticsController,
  listVendorUsersController,
  updateVendorUserRoleController,
} from "../../controllers/vendor-admin.controller";

// ✅ New authorization system imports
import { authorize } from "../../middlewares/authorize.middleware";
import { Permission } from "../../constants/permissions";

const router = Router();

// ─────────────────────────────────────────────────────────────
// Authentication (required for all routes)
// ─────────────────────────────────────────────────────────────
router.use(authMiddleware);

// ─────────────────────────────────────────────────────────────
// 📊 Statistics & Reporting (Read-only)
// Access: vendor_admin OR vendor_staff (both have VENDOR_STATS_READ)
// ─────────────────────────────────────────────────────────────
router.get(
  "/statistics",
  authorize(Permission.VENDOR_STATS_READ),
  validate(getVendorStatisticsSchema),
  getVendorStatisticsController
);

// ─────────────────────────────────────────────────────────────
// 👥 Staff List & Details (Read-only)
// Access: vendor_admin OR vendor_staff (both have STAFF_READ)
// ─────────────────────────────────────────────────────────────
router.get(
  "/users",
  authorize(Permission.STAFF_READ),
  validate(listVendorUsersSchema),
  listVendorUsersController
);

router.get(
  "/users/:id",
  authorize(Permission.STAFF_READ),
  validate(getVendorUserSchema),
  getVendorUserController
);

// ─────────────────────────────────────────────────────────────
// 🔐 Staff Management (Write operations - Admin only)
// Access: vendor_admin ONLY (has STAFF_INVITE, STAFF_REVOKE)
// Note: VENDOR_STAFF does NOT have these permissions by default
// ─────────────────────────────────────────────────────────────

// Block/Unblock a staff member
router.patch(
  "/users/:id/block",
  authorize(Permission.STAFF_REVOKE), // Revoke access = block
  validate(blockUserSchema),
  blockVendorUserController
);

// Change staff role (e.g., downgrade from admin to staff)
router.patch(
  "/users/:id/role",
  authorize(Permission.STAFF_INVITE), // Managing roles = invite-level permission
  validate(updateUserRoleSchema),
  updateVendorUserRoleController
);

export default router;