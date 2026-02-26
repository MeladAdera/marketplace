// src/validations/order.validation.ts
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// 🔹 Common Schemas (Reusable)
// ─────────────────────────────────────────────────────────────

/**
 * UUID validation (PostgreSQL UUID format)
 */
export const uuidSchema = z
  .string({
    required_error: "validation.uuid_required",
    invalid_type_error: "validation.uuid_invalid",
  })
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: "validation.uuid_invalid",
  });

/**
 * Pagination schema (reusable across endpoints)
 */
export const paginationSchema = {
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 1))
    .refine((val) => !isNaN(val) && val >= 1, {
      message: "validation.page_invalid",
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 20))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 100, {
      message: "validation.limit_invalid",
    }),
};

// ─────────────────────────────────────────────────────────────
// 🔹 Checkout Request Validation (POST /orders)
// ─────────────────────────────────────────────────────────────

/**
 * Shipping address schema
 */
const shippingAddressSchema = z.object({
  recipient_name: z
    .string({
      required_error: "validation.recipient_name_required",
    })
    .min(2, { message: "validation.recipient_name_min" })
    .max(100, { message: "validation.recipient_name_max" }),

  address_line1: z
    .string({
      required_error: "validation.address_line1_required",
    })
    .min(5, { message: "validation.address_line1_min" })
    .max(255, { message: "validation.address_line1_max" }),

  address_line2: z
    .string()
    .optional()
    .nullable()
    .max(255, { message: "validation.address_line2_max" }),

  city: z
    .string({
      required_error: "validation.city_required",
    })
    .min(2, { message: "validation.city_min" })
    .max(100, { message: "validation.city_max" }),

  state: z
    .string()
    .optional()
    .nullable()
    .max(100, { message: "validation.state_max" }),

  postal_code: z
    .string({
      required_error: "validation.postal_code_required",
    })
    .min(3, { message: "validation.postal_code_min" })
    .max(20, { message: "validation.postal_code_max" }),

  country: z
    .string({
      required_error: "validation.country_required",
    })
    .length(2, { message: "validation.country_length" }), // ISO 3166-1 alpha-2

  phone: z
    .string()
    .optional()
    .nullable()
    .regex(/^\+?[0-9]{8,15}$/, {
      message: "validation.phone_invalid",
    }),
});

/**
 * Checkout request body schema
 */
export const checkoutSchema = z.object({
  client_request_id: z
    .string({
      required_error: "validation.client_request_id_required",
    })
    .min(8, { message: "validation.client_request_id_min" })
    .max(64, { message: "validation.client_request_id_max" }),

  payment_method: z
    .enum(["fake"], {
      errorMap: () => ({ message: "validation.payment_method_unsupported" }),
    }),

  shipping_address: shippingAddressSchema,

  notes: z
    .string()
    .optional()
    .max(1000, { message: "validation.notes_max" }),
});

// ─────────────────────────────────────────────────────────────
// 🔹 Order Listing Validation (GET /orders)
// ─────────────────────────────────────────────────────────────

/**
 * Query parameters for order listing
 */
export const listOrdersSchema = z.object({
  status: z
    .enum(["pending_payment", "paid", "cancelled"])
    .optional(),

  from_date: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "validation.date_invalid",
    }),

  to_date: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "validation.date_invalid",
    }),

  ...paginationSchema,
});

// ─────────────────────────────────────────────────────────────
// 🔹 Get Single Order Validation (GET /orders/:id)
// ─────────────────────────────────────────────────────────────

/**
 * URL parameters for single order
 */
export const getOrderParamsSchema = z.object({
  id: uuidSchema,
});

// ─────────────────────────────────────────────────────────────
// 🔹 Refund Request Validation (POST /orders/:id/refund)
// ─────────────────────────────────────────────────────────────

/**
 * Refund request body schema
 */
export const refundSchema = z.object({
  reason: z
    .string({
      required_error: "validation.refund_reason_required",
    })
    .min(10, { message: "validation.refund_reason_min" })
    .max(500, { message: "validation.refund_reason_max" }),

  restock_inventory: z
    .boolean()
    .optional()
    .default(true),
});

/**
 * URL parameters for refund endpoint
 */
export const refundParamsSchema = z.object({
  id: uuidSchema,
});

// ─────────────────────────────────────────────────────────────
// 🔹 Export Types (for controllers)
// ─────────────────────────────────────────────────────────────

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;
export type GetOrderParamsInput = z.infer<typeof getOrderParamsSchema>;
export type RefundInput = z.infer<typeof refundSchema>;
export type RefundParamsInput = z.infer<typeof refundParamsSchema>;