// src/routes/vendor.routes.tss
import { Router } from "express";
import { 
  registerVendorController,
  getVendorProfileController,
  inviteStaffController,
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
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { 
  registerVendorValidation,
  inviteStaffValidation,
  getVendorProductsValidation, 
  updateVendorValidation,
  // Product validations
  createProductValidation,
  updateProductValidation,
  deleteProductValidation,
  getProductByIdValidation,
  // Inventory validations
  updateStockValidation,
  getInventoryHistoryValidation,
  checkStockValidation
} from "../validations";

const router = Router();

// ✅ Public route
router.post("/register", validate(registerVendorValidation), registerVendorController);

// ✅ Protected routes
router.use(authMiddleware); 

// ─────────────────────────────────────────────────────────────
// Vendor Profile
// ─────────────────────────────────────────────────────────────
router.get("/me", getVendorProfileController);
router.patch("/me", validate(updateVendorValidation), updateVendorProfileController);

// ─────────────────────────────────────────────────────────────
// Vendor Users (Staff Management)
// ─────────────────────────────────────────────────────────────
router.post("/users/invite", validate(inviteStaffValidation), inviteStaffController);

// ─────────────────────────────────────────────────────────────
// Vendor Products
// ─────────────────────────────────────────────────────────────
router.get(
  "/products", 
  validate(getVendorProductsValidation), 
  getVendorProductsController
);
router.post(
  "/products", 
  validate(createProductValidation), 
  createProductController
);
router.get(
  "/products/:id", 
  validate(getProductByIdValidation), 
  getVendorProductByIdController
);
router.patch(
  "/products/:id", 
  validate(updateProductValidation), 
  updateProductController
);
router.delete(
  "/products/:id", 
  validate(deleteProductValidation), 
  deleteProductController
);

// ─────────────────────────────────────────────────────────────
// Vendor Inventory (NEW!)
// ─────────────────────────────────────────────────────────────
router.patch(
  "/inventory/:variantId", 
  validate(updateStockValidation), 
  updateStockController
);
router.get(
  "/inventory/history", 
  validate(getInventoryHistoryValidation), 
  getInventoryHistoryController
);
router.get(
  "/inventory/check", 
  validate(checkStockValidation), 
  checkStockController
);

export default router;