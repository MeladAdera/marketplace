// src/services/cart.service.ts
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
import {  ValidationError, NotFoundError } from "../errors/AppError";
import { AuditService } from "./audit.service"; // We'll create this if not exists

/**
 * Service: Add item to cart
 * @throws {ValidationError} if variant invalid or insufficient stock
 */
export async function addToCartService(
  userId: string,
  input: AddToCartInput,
  t?: (key: string, params?: any) => string
): Promise<CartItemWithDetails> {
  // Validate quantity
  if (input.quantity < 1 || input.quantity > 999) {
    throw new ValidationError(
      t?.("cart.invalid_quantity", { ns: "errors" }) || "Invalid quantity",
      { field: "quantity", code: "out_of_range" }
    );
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(input.variantId)) {
    throw new ValidationError(
      t?.("validation.invalid_uuid", { ns: "errors" }) || "Invalid variant ID",
      { field: "variantId", code: "invalid_string" }
    );
  }

  try {
    const cartItem = await addToCart(userId, input);

    // 📝 Log to audit (optional, non-blocking)
    await AuditService.log({
      actorUserId: userId,
      action: "CART_ITEM_ADDED",
      entityType: "cart_item",
      entityId: cartItem.id,
      newValues: {
        variantId: cartItem.variantId,
        quantity: cartItem.quantity,
      },
     }).catch((err: Error) => console.error("Audit log failed:", err)); 

    return cartItem;
  } catch (error: any) {
    if (error.message === "VARIANT_NOT_FOUND_OR_INACTIVE") {
      throw new NotFoundError(
        t?.("product.variant_not_found", { ns: "errors" }) || "Variant not found or inactive"
      );
    }
    if (error.message === "INSUFFICIENT_STOCK") {
      throw new ValidationError(
        t?.("inventory.insufficient_stock", { ns: "errors" }) || "Insufficient stock available",
        { field: "quantity", code: "insufficient_stock" }
      );
    }
    throw error;
  }
}

/**
 * Service: Get user's cart grouped by vendor
 */
export async function getCartService(
  userId: string,
  t?: (key: string, params?: any) => string
): Promise<CartResponse & { meta?: { price_disclaimer?: string } }> {
  const cart = await getUserCartGroupedByVendor(userId);

  // Add price disclaimer
  return {
    ...cart,
    meta: {
      price_disclaimer: t?.("cart.price_may_change", { ns: "errors" }) || "Prices may change before checkout",
    },
  };
}

/**
 * Service: Update cart item quantity
 * @throws {NotFoundError} if cart item not found
 * @throws {ValidationError} if quantity invalid or insufficient stock
 */
export async function updateCartItemService(
  userId: string,
  cartItemId: string,
  input: UpdateCartItemInput,
  t?: (key: string, params?: any) => string
): Promise<CartItemWithDetails> {
  // Validate quantity
  if (input.quantity < 1 || input.quantity > 999) {
    throw new ValidationError(
      t?.("cart.invalid_quantity", { ns: "errors" }) || "Invalid quantity",
      { field: "quantity", code: "out_of_range" }
    );
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(cartItemId)) {
    throw new ValidationError(
      t?.("validation.invalid_uuid", { ns: "errors" }) || "Invalid cart item ID",
      { field: "cartItemId", code: "invalid_string" }
    );
  }

  try {
    const cartItem = await updateCartItem(userId, cartItemId, input);

    // 📝 Log to audit
    await AuditService.log({
      actorUserId: userId,
      action: "CART_ITEM_UPDATED",
      entityType: "cart_item",
      entityId: cartItem.id,
      oldValues: { quantity: "previous" },
      newValues: { quantity: cartItem.quantity },
     }).catch((err: Error) => console.error("Audit log failed:", err));

    return cartItem;
  } catch (error: any) {
    if (error.message === "CART_ITEM_NOT_FOUND") {
      throw new NotFoundError(
        t?.("cart.item_not_found", { ns: "errors" }) || "Cart item not found"
      );
    }
    if (error.message === "ITEM_NO_LONGER_AVAILABLE") {
      throw new ValidationError(
        t?.("product.no_longer_available", { ns: "errors" }) || "Item no longer available",
        { field: "variantId", code: "unavailable" }
      );
    }
    if (error.message === "INSUFFICIENT_STOCK") {
      throw new ValidationError(
        t?.("inventory.insufficient_stock", { ns: "errors" }) || "Insufficient stock available",
        { field: "quantity", code: "insufficient_stock" }
      );
    }
    throw error;
  }
}

/**
 * Service: Remove item from cart
 * @throws {NotFoundError} if cart item not found
 */
export async function removeCartItemService(
  userId: string,
  cartItemId: string,
  t?: (key: string, params?: any) => string
): Promise<{ success: boolean; message: string }> {
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(cartItemId)) {
    throw new ValidationError(
      t?.("validation.invalid_uuid", { ns: "errors" }) || "Invalid cart item ID",
      { field: "cartItemId", code: "invalid_string" }
    );
  }

  const removed = await removeCartItem(userId, cartItemId);

  if (!removed) {
    throw new NotFoundError(
      t?.("cart.item_not_found", { ns: "errors" }) || "Cart item not found"
    );
  }

  // 📝 Log to audit
  await AuditService.log({
    actorUserId: userId,
    action: "CART_ITEM_REMOVED",
    entityType: "cart_item",
    entityId: cartItemId,
 }).catch((err: Error) => console.error("Audit log failed:", err));

  return {
    success: true,
    message: t?.("cart.item_removed", { ns: "product" }) || "Item removed from cart",
  };
}

/**
 * Service: Clear entire cart
 */
export async function clearCartService(
  userId: string,
  t?: (key: string, params?: any) => string
): Promise<{ success: boolean; message: string; itemsRemoved: number }> {
  const itemsRemoved = await clearCart(userId);

  // 📝 Log to audit
  if (itemsRemoved > 0) {
    await AuditService.log({
      actorUserId: userId,
      action: "CART_CLEARED",
      entityType: "cart",
      metadata: { itemsRemoved },
    }).catch((err:Error) => console.error("Audit log failed:", err));
  }

  return {
    success: true,
    message: t?.("cart.cleared", { ns: "product" }) || "Cart cleared",
    itemsRemoved,
  };
}