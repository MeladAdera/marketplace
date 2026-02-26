// src/validations/cart.validation.ts
import { z } from "zod";

/**
 * Add item to cart
 */
export const addToCartSchema = z.object({
  body: z.object({
    variantId: z.string({
      required_error: "variantId is required",
      invalid_type_error: "variantId must be a string",
    }).uuid("variantId must be a valid UUID"),
    
    quantity: z.number({
      required_error: "quantity is required",
      invalid_type_error: "quantity must be a number",
    })
      .int("quantity must be an integer")
      .min(1, "quantity must be at least 1")
      .max(999, "quantity cannot exceed 999"),
  }),
});

/**
 * Update cart item quantity
 */
export const updateCartItemSchema = z.object({
  params: z.object({
    id: z.string({
      required_error: "Cart item ID is required",
      invalid_type_error: "Cart item ID must be a string",
    }).uuid("Cart item ID must be a valid UUID"),
  }),
  body: z.object({
    quantity: z.number({
      required_error: "quantity is required",
      invalid_type_error: "quantity must be a number",
    })
      .int("quantity must be an integer")
      .min(1, "quantity must be at least 1")
      .max(999, "quantity cannot exceed 999"),
  }),
});

/**
 * Remove cart item
 */
export const removeCartItemSchema = z.object({
  params: z.object({
    id: z.string({
      required_error: "Cart item ID is required",
      invalid_type_error: "Cart item ID must be a string",
    }).uuid("Cart item ID must be a valid UUID"),
  }),
});

/**
 * Clear cart (no body/params needed)
 */
export const clearCartSchema = z.object({});

/**
 * Get cart (no body/params needed)
 */
export const getCartSchema = z.object({});