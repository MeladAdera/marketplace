// src/routes/cart.routes.ts
import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  getCartController,
  addToCartController,
  updateCartItemController,
  removeCartItemController,
  clearCartController,
} from "../controllers/cart.controller";
import {
  getCartSchema,
  addToCartSchema,
  updateCartItemSchema,
  removeCartItemSchema,
  clearCartSchema,
} from "../validations/cart.validation";

// ✅ استيرادات النظام الجديد
import { authorize } from "../middlewares/authorize.middleware";
import { Permission } from "../constants/permissions";

const router = Router();

// All cart routes require authentication
router.use(authMiddleware);

/**
 * GET /cart
 */
router.get(
  "/",
  authorize(Permission.CART_READ),
  validate(getCartSchema),
  getCartController
);

/**
 * POST /cart/items
 */
router.post(
  "/items",
  authorize(Permission.CART_CREATE),
  validate(addToCartSchema),
  addToCartController
);

/**
 * PATCH /cart/items/:id
 */
router.patch(
  "/items/:id",
  authorize(Permission.CART_UPDATE),
  validate(updateCartItemSchema),
  updateCartItemController
);

/**
 * DELETE /cart/items/:id
 */
router.delete(
  "/items/:id",
  authorize(Permission.CART_DELETE),
  validate(removeCartItemSchema),
  removeCartItemController
);

/**
 * DELETE /cart
 */
router.delete(
  "/",
  authorize(Permission.CART_DELETE),
  validate(clearCartSchema),
  clearCartController
);

export default router;