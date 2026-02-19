// src/validations/common.validation.ts
import { z } from "zod";

/**
 * =======================================================
 * UUID VALIDATION
 * =======================================================
 */
export const uuidSchema = z.string().uuid("Invalid ID format (must be UUID)");

/**
 * =======================================================
 * EMAIL VALIDATION
 * =======================================================
 */
export const emailSchema = z
  .string()
  .min(5, "Email must be at least 5 characters")
  .max(100, "Email must not exceed 100 characters")
  .email("Invalid email format (example: user@domain.com)")
  .transform(email => email.toLowerCase().trim());

/**
 * =======================================================
 * PASSWORD VALIDATION
 * =======================================================
 */
export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(100, "Password must not exceed 100 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
    "Password must contain at least one uppercase letter, one lowercase letter, and one number"
  );

export const passwordLoginSchema = z
  .string()
  .min(1, "Password is required");

/**
 * =======================================================
 * SLUG VALIDATION
 * =======================================================
 */
export const slugSchema = z
  .string()
  .min(3, "Slug must be at least 3 characters")
  .max(50, "Slug must not exceed 50 characters")
  .regex(
    /^[a-z0-9-]+$/, 
    "Slug can only contain lowercase letters, numbers, and hyphens (no spaces, no special characters)"
  );

/**
 * =======================================================
 * PAGINATION VALIDATION - ✅ FIXED
 * =======================================================
 * 
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/, "Page must be a valid number")
    .default("1")                    
    .transform(Number)                
    .refine(n => n >= 1, "Page must be at least 1"),
  
  limit: z
    .string()
    .regex(/^\d+$/, "Limit must be a valid number")
    .default("10")                    
    .transform(Number)                
    .refine(n => n >= 1 && n <= 100, "Limit must be between 1 and 100")
});

/**
 * =======================================================
 * IP ADDRESS VALIDATION
 * =======================================================
 */
export const ipSchema = z
  .string()
  .regex(
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^::1$|^unknown$/,
    "Invalid IP address format"
  )
  .optional()
  .default("unknown");

/**
 * =======================================================
 * ROLE VALIDATION
 * =======================================================
 */
export const roleSchema = z.enum([
  'customer', 
  'vendor_staff', 
  'vendor_admin', 
  'support', 
  'platform_admin'
]);

/**
 * =======================================================
 * COMPANY NAME VALIDATION
 * =======================================================
 */
export const companyNameSchema = z
  .string()
  .min(3, "Company name must be at least 3 characters")
  .max(100, "Company name must not exceed 100 characters")
  .trim();

/**
 * =======================================================
 * PRODUCT NAME VALIDATION
 * =======================================================
 */
export const productNameSchema = z
  .string()
  .min(3, "Product name must be at least 3 characters")
  .max(100, "Product name must not exceed 100 characters")
  .trim();

/**
 * =======================================================
 * PRICE VALIDATION
 * =======================================================
 */
export const priceSchema = z
  .number()
  .positive("Price must be greater than 0")
  .max(999999.99, "Price is too high");

/**
 * =======================================================
 * STOCK QUANTITY VALIDATION
 * =======================================================
 */
export const stockSchema = z
  .number()
  .int("Stock must be a whole number")
  .min(0, "Stock cannot be negative")
  .max(999999, "Stock is too high");