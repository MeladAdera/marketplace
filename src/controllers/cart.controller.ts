// src/controllers/cart.controller.ts
import { Response } from "express";
import { asyncHandler } from "../middlewares/errorHandler.middleware";
import { AuthRequest } from "../middlewares/auth.middleware";
import { 
  addToCartService, 
  getCartService, 
  updateCartItemService, 
  removeCartItemService,
  clearCartService 
} from "../services/cart.service";

/**
 * GET /cart
 * Get current user's cart grouped by vendor
 */
export const getCartController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const cart = await getCartService(userId);

  return res.status(200).json({
    success: true,
    data: cart,
  });
});

/**
 * POST /cart/items
 * Add item to cart
 */
export const addToCartController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const t = req.t;

  const cartItem = await addToCartService(userId, req.body);

  return res.status(200).json({
    success: true,
    data: {
      cartItem,
      message: t("cart.item_added", { ns: "product" }) || "Item added to cart",
    },
  });
});

/**
 * PATCH /cart/items/:id
 * Update cart item quantity
 */
export const updateCartItemController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const t = req.t;
  const { id } = req.params as { id: string };

  const cartItem = await updateCartItemService(userId, id, req.body);

  return res.status(200).json({
    success: true,
    data: {
      cartItem,
      message: t("cart.item_updated", { ns: "product" }) || "Cart item updated",
    },
  });
});

/**
 * DELETE /cart/items/:id
 * Remove item from cart
 */
export const removeCartItemController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params as { id: string };

  const result = await removeCartItemService(userId, id);

  return res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * DELETE /cart
 * Clear entire cart
 */
export const clearCartController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const result = await clearCartService(userId);

  return res.status(200).json({
    success: true,
    data: result,
  });
});