// src/routes/vendor/vendor-admin.routes.ts
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  getVendorStatisticsSchema,
  listVendorUsersSchema,
} from "../../validations/vendor-admin.validation";
import {
  getVendorStatisticsController,
  listVendorUsersController,
} from "../../controllers/vendor-admin.controller";

import { authorize } from "../../middlewares/authorize.middleware";
import { Permission } from "../../constants/permissions";

const router = Router();

router.use(authMiddleware);

// ── Statistics ──────────────────────────────────────────────
router.get(
  "/statistics",
  authorize(Permission.VENDOR_STATS_READ),
  validate(getVendorStatisticsSchema),
  getVendorStatisticsController
);

// ── User Management ─────────────────────────────────────────
router.get(
  "/users",
  authorize(Permission.STAFF_READ),
  validate(listVendorUsersSchema),
  listVendorUsersController
);

export default router;