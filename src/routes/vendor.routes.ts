// src/routes/vendor.routes.ts
import { Router } from "express";
import { 
  registerVendorController,
  getVendorProfileController,
  inviteStaffController,
  getVendorProductsController
} from "../controllers/vendor.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { 
  registerVendorValidation,
  inviteStaffValidation,
  getVendorProductsValidation 
} from "../validations";

const router = Router();

router.post("/register", validate(registerVendorValidation), registerVendorController);

router.use(authMiddleware);

router.get("/me", getVendorProfileController);

router.post("/users/invite", validate(inviteStaffValidation), inviteStaffController);
router.get("/users", getVendorProfileController); 

router.get("/products", validate(getVendorProductsValidation), getVendorProductsController);;
// router.post("/products", createProductController);
// router.patch("/products/:id", updateProductController);
// router.delete("/products/:id", deleteProductController);

export default router;