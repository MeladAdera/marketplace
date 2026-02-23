// src/validations/inventory.validation.ts
import { z } from "zod";
import { uuidSchema, paginationSchema } from "./common.validation";

/**
 * =======================================================
 * UPDATE STOCK VALIDATION
 * =======================================================
 * PATCH /vendor/inventory/:variantId
 */
export const updateStockValidation = z.object({
  params: z.object({
    variantId: uuidSchema
  }),
  
  body: z.object({
    quantity: z
      .number()
      .int("Quantity must be a whole number")
      .min(0, "Quantity cannot be negative")
      .max(999999, "Quantity is too high"),
    
    reason: z
      .string()
      .max(500, "Reason cannot exceed 500 characters")
      .optional()
  })
});

/**
 * =======================================================
 * GET INVENTORY HISTORY VALIDATION
 * =======================================================
 * GET /vendor/inventory/history
 */
export const getInventoryHistoryValidation = z.object({
  query: paginationSchema.extend({
    variantId: uuidSchema.optional()
  })
});

/**
 * =======================================================
 * CHECK STOCK AVAILABILITY VALIDATION
 * =======================================================
 * GET /vendor/inventory/check
 */
export const checkStockValidation = z.object({
  query: z.object({
    variantId: uuidSchema,
    quantity: z
      .string()
      .optional()
      .transform(val => val ? parseInt(val) : 1)
      .refine(val => !isNaN(val) && val > 0, "Quantity must be a positive number")
  })
});