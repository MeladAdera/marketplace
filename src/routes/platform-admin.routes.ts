// src/routes/platform-admin.routes.ts
// Platform Admin - Vendor Management Routes

import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/authorize.middleware";
import { validate } from "../middlewares/validate.middleware";
import { Permission } from "../constants/permissions";

// Controllers
import {
  listAdminVendorsController,
  getVendorAdminController,
  updateVendorAdminController,
  suspendVendorController,
  activateVendorController,
  deleteVendorAdminController,
  restoreVendorController,
} from "../controllers/platform-admin.controller";

// Validations
import {
  listAdminVendorsSchema,
  updateAdminVendorSchema,
  suspendVendorSchema,
  activateVendorSchema,
  deleteVendorSchema,
  vendorIdParamsSchema,
  restoreVendorSchema,
} from "../validations/vendor.validation";

const router = Router();

// 🔐 Global auth for all platform admin routes
router.use(authMiddleware);

/** 📋 GET /platform/admin/vendors — List vendors */
router.get(
  "/vendors",
  authorize(Permission.PLATFORM_VENDOR_READ),
  validate(listAdminVendorsSchema),
  listAdminVendorsController
);

/** 🔍 GET /platform/admin/vendors/:id — Vendor details */
router.get(
  "/vendors/:id",
  authorize(Permission.PLATFORM_VENDOR_READ),
  validate({ params: vendorIdParamsSchema }),
  getVendorAdminController
);

/** ✏️ PATCH /platform/admin/vendors/:id — Update vendor */
router.patch(
  "/vendors/:id",
  authorize(Permission.PLATFORM_VENDOR_UPDATE),
  validate(updateAdminVendorSchema),
  updateVendorAdminController
);

/** 🚫 PATCH /platform/admin/vendors/:id/suspend — Suspend vendor */
router.patch(
  "/vendors/:id/suspend",
  authorize(Permission.PLATFORM_VENDOR_SUSPEND),
  validate(suspendVendorSchema),
  suspendVendorController
);

/** ✅ PATCH /platform/admin/vendors/:id/activate — Activate vendor */
router.patch(
  "/vendors/:id/activate",
  authorize(Permission.PLATFORM_VENDOR_ACTIVATE),
  validate(activateVendorSchema),
  activateVendorController
);

/** 🗑️ DELETE /platform/admin/vendors/:id — Soft delete vendor */
router.delete(
  "/vendors/:id",
  authorize(Permission.PLATFORM_VENDOR_DELETE),
  validate(deleteVendorSchema),
  deleteVendorAdminController
);

/** 🔄 POST /platform/admin/vendors/:id/restore — Restore vendor */
router.post(
  "/vendors/:id/restore",
  authorize(Permission.PLATFORM_VENDOR_DELETE),
  validate(restoreVendorSchema),  
  restoreVendorController
);

export default router;