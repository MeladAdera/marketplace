// src/routes/vendor.routes.ts
import { Router } from "express";
import { 
  registerVendorController,
  getVendorProfileController,
  updateVendorProfileController
} from "../controllers/vendor.controller";
import { 
  createProductController,
  getVendorProductsController,
  getVendorProductByIdController,
  updateProductController,
  deleteProductController 
} from "../controllers/product.controller";
import {
  updateStockController,
  getInventoryHistoryController,
  checkStockController
} from "../controllers/inventory.controller";
import {
  inviteStaffController,
  acceptInvitationController,
  revokeInvitationController,
  listInvitationsController,
} from "../controllers/vendor-user.controller";

import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { 
  registerVendorValidation,
  inviteStaffValidation,
  getVendorProductsValidation, 
  updateVendorValidation,
  createProductValidation,
  updateProductValidation,
  deleteProductValidation,
  getProductByIdValidation,
  updateStockValidation,
  getInventoryHistoryValidation,
  checkStockValidation,
  acceptInvitationValidation,
  revokeInvitationValidation,
  listInvitationsValidation,
} from "../validations";

import { authorize } from "../middlewares/authorize.middleware";
import { Permission } from "../constants/permissions";

const router = Router();

// ─────────────────────────────────────────────────────────────
// ✅ Public route (لا يحتاج مصادقة)
// ─────────────────────────────────────────────────────────────
router.post(
  "/register", 
  validate(registerVendorValidation), 
  registerVendorController
);

// ─────────────────────────────────────────────────────────────
// ✅ Protected routes (تتطلب مصادقة)
// ─────────────────────────────────────────────────────────────
router.use(authMiddleware); 

// ─────────────────────────────────────────────────────────────
// 👤 Vendor Profile
// ─────────────────────────────────────────────────────────────
router.get(
  "/me", 
  authorize(Permission.PROFILE_READ), 
  getVendorProfileController
);

router.patch(
  "/me", 
  authorize(Permission.PROFILE_UPDATE), 
  validate(updateVendorValidation), 
  updateVendorProfileController
);

// ─────────────────────────────────────────────────────────────
// 👥 Vendor Users (Staff Management)
// ─────────────────────────────────────────────────────────────
router.post(
  "/users/invite", 
  authorize(Permission.STAFF_INVITE), 
  validate(inviteStaffValidation), 
  inviteStaffController
);

router.get(
  "/invitations",
  authorize(Permission.STAFF_READ), 
  validate(listInvitationsValidation), 
  listInvitationsController
);

router.delete(
  "/invitations/:id", 
  authorize(Permission.STAFF_REVOKE), 
  validate(revokeInvitationValidation), 
  revokeInvitationController
);

router.post(
  "/invitations/accept",
  authorize(Permission.STAFF_INVITE), 
  validate(acceptInvitationValidation), 
  acceptInvitationController
);

// ─────────────────────────────────────────────────────────────
// 📦 Vendor Products
// ─────────────────────────────────────────────────────────────
router.get(
  "/products", 
  authorize(Permission.PRODUCT_READ), 
  validate(getVendorProductsValidation), 
  getVendorProductsController
);

router.post(
  "/products", 
  authorize(Permission.PRODUCT_CREATE), 
  validate(createProductValidation), 
  createProductController
);

router.get(
  "/products/:id", 
  authorize(Permission.PRODUCT_READ), 
  validate(getProductByIdValidation), 
  getVendorProductByIdController
);

router.patch(
  "/products/:id", 
  authorize(Permission.PRODUCT_UPDATE), 
  validate(updateProductValidation), 
  updateProductController
);

router.delete(
  "/products/:id", 
  authorize(Permission.PRODUCT_DELETE), 
  validate(deleteProductValidation), 
  deleteProductController
);

// ─────────────────────────────────────────────────────────────
// 📊 Vendor Inventory
// ─────────────────────────────────────────────────────────────
router.patch(
  "/inventory/:variantId", 
  authorize(Permission.INVENTORY_UPDATE), 
  validate(updateStockValidation), 
  updateStockController
);

router.get(
  "/inventory/history", 
  authorize(Permission.INVENTORY_READ), 
  validate(getInventoryHistoryValidation), 
  getInventoryHistoryController
);

router.get(
  "/inventory/check", 
  authorize(Permission.INVENTORY_READ), 
  validate(checkStockValidation), 
  checkStockController
);

export default router;