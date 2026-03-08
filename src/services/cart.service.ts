import { 
  addToCart, 
  getUserCartGroupedByVendor, 
  updateCartItem, 
  removeCartItem,
  clearCart 
} from "../repository/cart.repo";

import { 
  AddToCartInput, 
  UpdateCartItemInput, 
  CartResponse, 
  CartItemWithDetails 
} from "../types/cart.types";

import { ValidationError, NotFoundError } from "../errors/AppError";
import { AuditService } from "./audit.service";

/**
 * Add item to cart
 */
export async function addToCartService(
  userId: string,
  input: AddToCartInput
): Promise<CartItemWithDetails> {

  if (input.quantity < 1 || input.quantity > 999) {
    throw new ValidationError(
      "cart.invalid_quantity",
      { ns: "errors" },
      { field: "quantity", code: "out_of_range" }
    );
  }

  try {

    const cartItem = await addToCart(userId, input);

    await AuditService.log({
      actorUserId: userId,
      action: "CART_ITEM_ADDED",
      entityType: "cart_item",
      entityId: cartItem.id,
      newValues: {
        variantId: cartItem.variantId,
        quantity: cartItem.quantity,
      },
    }).catch((err: Error) =>
      console.error("Audit log failed:", err)
    );

    return cartItem;

  } catch (error: any) {

    if (error.message === "VARIANT_NOT_FOUND_OR_INACTIVE") {
      throw new NotFoundError("product.variant_not_found");
    }

    if (error.message === "INSUFFICIENT_STOCK") {
      throw new ValidationError(
        "inventory.insufficient_stock",
        { ns: "errors" },
        { field: "quantity", code: "insufficient_stock" }
      );
    }

    throw error;
  }
}

/**
 * Get user cart
 */
export async function getCartService(
  userId: string,
  t?: (key: string, params?: any) => string
): Promise<CartResponse & { meta?: { price_disclaimer?: string } }> {

  const cart = await getUserCartGroupedByVendor(userId);

  return {
    ...cart,
    meta: {
      price_disclaimer:
        t?.("cart.price_may_change", { ns: "errors" }) ||
        "Prices may change before checkout",
    },
  };
}

/**
 * Update cart item
 */
export async function updateCartItemService(
  userId: string,
  cartItemId: string,
  input: UpdateCartItemInput
): Promise<CartItemWithDetails> {

  if (input.quantity < 1 || input.quantity > 999) {
    throw new ValidationError(
      "cart.invalid_quantity",
      { ns: "errors" },
      { field: "quantity", code: "out_of_range" }
    );
  }

  try {

    const cartItem = await updateCartItem(userId, cartItemId, input);

    await AuditService.log({
      actorUserId: userId,
      action: "CART_ITEM_UPDATED",
      entityType: "cart_item",
      entityId: cartItem.id,
      oldValues: { quantity: "previous" },
      newValues: { quantity: cartItem.quantity },
    }).catch((err: Error) =>
      console.error("Audit log failed:", err)
    );

    return cartItem;

  } catch (error: any) {

    if (error.message === "CART_ITEM_NOT_FOUND") {
      throw new NotFoundError("cart.item_not_found");
    }

    if (error.message === "ITEM_NO_LONGER_AVAILABLE") {
      throw new ValidationError(
        "product.no_longer_available",
        { ns: "errors" },
        { field: "variantId", code: "unavailable" }
      );
    }

    if (error.message === "INSUFFICIENT_STOCK") {
      throw new ValidationError(
        "inventory.insufficient_stock",
        { ns: "errors" },
        { field: "quantity", code: "insufficient_stock" }
      );
    }

    throw error;
  }
}

/**
 * Remove cart item
 */
export async function removeCartItemService(
  userId: string,
  cartItemId: string
): Promise<{ success: boolean; messageKey: string }> {

  const removed = await removeCartItem(userId, cartItemId);

  if (!removed) {
    throw new NotFoundError("cart.item_not_found");
  }

  await AuditService.log({
    actorUserId: userId,
    action: "CART_ITEM_REMOVED",
    entityType: "cart_item",
    entityId: cartItemId,
  }).catch((err: Error) =>
    console.error("Audit log failed:", err)
  );

  return {
    success: true,
    messageKey: "cart.item_removed",
  };
}

/**
 * Clear cart
 */
export async function clearCartService(
  userId: string
): Promise<{ success: boolean; messageKey: string; itemsRemoved: number }> {

  const itemsRemoved = await clearCart(userId);

  if (itemsRemoved > 0) {
    await AuditService.log({
      actorUserId: userId,
      action: "CART_CLEARED",
      entityType: "cart",
      metadata: { itemsRemoved },
    }).catch((err: Error) =>
      console.error("Audit log failed:", err)
    );
  }

  return {
    success: true,
    messageKey: "cart.cleared",
    itemsRemoved,
  };
}