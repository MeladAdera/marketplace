// src/routes/public.routes.ts
import { Router } from "express";
import { validate } from "../middlewares/validate.middleware";
import { 
  publicProductsValidation, 
  getProductValidation 
} from "../validations/product.validation";
import { 
  listProductsController, 
  getProductByIdController 
} from "../controllers/public.controller";

const router = Router();

// ✅ NO authMiddleware - these are PUBLIC endpoints

/**
 * GET /products
 * List all public products (Marketplace mode)
 */
router.get(
  "/", 
  validate(publicProductsValidation), 
  listProductsController
);

/**
 * GET /products/:id
 * Get single product details with variants
 */
router.get(
  "/:id", 
  validate(getProductValidation), 
  getProductByIdController
);

export default router;