// src/routes/vendor.routes.ts
import { Router } from "express";
import { 
  registerVendorController,
  getVendorProfileController,
  inviteStaffController,
  getVendorProductsController
} from "../controllers/vendor.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// المسارات العامة (لا تحتاج مصادقة)
router.post("/register", registerVendorController);

// جميع المسارات التالية تحتاج مصادقة
router.use(authMiddleware);

// ملف الشركة
router.get("/me", getVendorProfileController);
// router.patch("/me", updateVendorProfileController); // للتحديث لاحقاً

// إدارة الموظفين
router.post("/users/invite", inviteStaffController);
router.get("/users", getVendorProfileController); // نفس /me يعطي الموظفين

// إدارة المنتجات
router.get("/products", getVendorProductsController);
// router.post("/products", createProductController);
// router.patch("/products/:id", updateProductController);
// router.delete("/products/:id", deleteProductController);

export default router;