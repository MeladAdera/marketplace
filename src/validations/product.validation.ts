// src/validations/product.validation.ts
import { z } from "zod";
import { uuidSchema, paginationSchema } from "./common.validation";

/**
 * =======================================================
 * CREATE PRODUCT VALIDATION
 * =======================================================
 * POST /vendor/products
 */
export const createProductValidation = z.object({
  body: z.object({
    name: z
      .string()
      .min(3, "Product name must be at least 3 characters")
      .max(100, "Product name must not exceed 100 characters")
      .trim(),
    
    description: z
      .string()
      .max(1000, "Description must not exceed 1000 characters")
      .optional()
      .default(""),
    
    active: z.boolean().default(true),
    
    variants: z
      .array(z.object({
        sku: z
          .string()
          .min(3, "SKU must be at least 3 characters")
          .max(50, "SKU must not exceed 50 characters")
          .regex(
            /^[A-Z0-9-]+$/, 
            "SKU can only contain uppercase letters, numbers, and hyphens"
          ),
        
        price: z
          .number()
          .positive("Price must be greater than 0")
          .max(999999.99, "Price is too high")
          .transform(val => Math.round(val * 100) / 100),
        
        stock: z
          .number()
          .int("Stock must be a whole number")
          .min(0, "Stock cannot be negative")
          .max(999999, "Stock is too high")
      }))
      .min(1, "At least one variant is required")
      .refine(
        (variants) => {
          const skus = variants.map(v => v.sku);
          return skus.length === new Set(skus).size;
        },
        { message: "Duplicate SKUs are not allowed" }
      )
  })
});

/**
 * =======================================================
 * UPDATE PRODUCT VALIDATION
 * =======================================================
 * PATCH /vendor/products/:id
 */
export const updateProductValidation = z.object({
  params: z.object({
    id: uuidSchema
  }),
  
  body: z.object({
    name: z
      .string()
      .min(3, "Product name must be at least 3 characters")
      .max(100, "Product name must not exceed 100 characters")
      .trim()
      .optional(),
    
    description: z
      .string()
      .max(1000, "Description must not exceed 1000 characters")
      .optional(),
    
    categoryId: uuidSchema.optional(),
    
    active: z.boolean().optional()
  })
});

/**
 * =======================================================
 * DELETE PRODUCT VALIDATION
 * =======================================================
 * DELETE /vendor/products/:id
 */
export const deleteProductValidation = z.object({
  params: z.object({
    id: uuidSchema
  })
});

/**
 * =======================================================
 * GET PRODUCT BY ID VALIDATION
 * =======================================================
 * GET /vendor/products/:id
 */
export const getProductByIdValidation = z.object({
  params: z.object({
    id: uuidSchema
  })
});

/**
 * =======================================================
 * GET VENDOR PRODUCTS VALIDATION
 * =======================================================
 * GET /vendor/products
 */
export const getVendorProductsValidation = z.object({
  query: paginationSchema.extend({
    active: z
      .string()
      .optional()
      .refine(val => val === undefined || val === 'true' || val === 'false', "Active must be 'true' or 'false'")
      .transform(val => val === 'true' ? true : val === 'false' ? false : undefined),
    
    search: z
      .string()
      .max(50, "Search term too long")
      .optional()
      .transform(val => val?.trim())
  })
});

/**
 * =======================================================
 * PUBLIC PRODUCTS VALIDATION
 * =======================================================
 * GET /products (public catalog)
 */
export const publicProductsValidation = z.object({
  query: paginationSchema.extend({
    category: uuidSchema.optional(),
    vendor: uuidSchema.optional(),
    minPrice: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Invalid price format")
      .transform(Number)
      .optional(),
    maxPrice: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Invalid price format")
      .transform(Number)
      .optional(),
    search: z
      .string()
      .max(50, "Search term too long")
      .optional()
      .transform(val => val?.trim())
  })
});

/**
 * =======================================================
 * GET SINGLE PRODUCT VALIDATION (Public)
 * =======================================================
 * GET /products/:id
 */
export const getProductValidation = z.object({
  params: z.object({
    id: uuidSchema
  })
});