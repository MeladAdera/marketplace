// src/routes/vendor.routes.ts 

import { Router } from "express";
import { 
  registerVendorController,
  getVendorProfileController,
  inviteStaffController,
  getVendorProductsController,
  updateVendorProfileController
} from "../controllers/vendor.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { 
  registerVendorValidation,
  inviteStaffValidation,
  getVendorProductsValidation, 
  updateVendorValidation
} from "../validations";

const router = Router();

// ✅ Public route - 
router.post("/register", validate(registerVendorValidation), registerVendorController);

// ✅ Protected routes - 
router.use(authMiddleware); 

// vendor profile
router.get("/me", getVendorProfileController);

// vendor users
router.post("/users/invite", validate(inviteStaffValidation), inviteStaffController);

// vendor products
router.get("/products", validate(getVendorProductsValidation), getVendorProductsController);
router.patch("/me", validate(updateVendorValidation), updateVendorProfileController);  


// router.post("/products", createProductController);
// router.patch("/products/:id", updateProductController);
// router.delete("/products/:id", deleteProductController);

export default router;