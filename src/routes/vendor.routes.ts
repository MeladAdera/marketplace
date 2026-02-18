// src/routes/vendor.routes.ts
import { Router } from "express";
import { 
  registerVendorController, 
  getVendorProfileController 
} from "../controllers/vendor.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// المسارات العامة
router.post("/register", registerVendorController);

// المسارات المحمية
router.get("/me", authMiddleware, getVendorProfileController);
// router.patch("/me", authMiddleware, updateVendorProfileController);

export default router;