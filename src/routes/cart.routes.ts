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

const router = Router();

// All cart routes require authentication
router.use(authMiddleware);

/**
 * GET /cart
 */
router.get(
  "/",
  validate(getCartSchema),
  getCartController
);

/**
 * POST /cart/items
 */
router.post(
  "/items",
  validate(addToCartSchema),
  addToCartController
);

/**
 * PATCH /cart/items/:id
 */
router.patch(
  "/items/:id",
  validate(updateCartItemSchema),
  updateCartItemController
);

/**
 * DELETE /cart/items/:id
 */
router.delete(
  "/items/:id",
  validate(removeCartItemSchema),
  removeCartItemController
);

/**
 * DELETE /cart
 */
router.delete(
  "/",
  validate(clearCartSchema),
  clearCartController
);

export default router;