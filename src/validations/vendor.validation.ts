// src/validations/vendor.validation.ts
import { z } from "zod";
import { 
  emailSchema, 
  slugSchema, 
  paginationSchema,
  uuidSchema 
} from "./common.validation";

/**
 * =======================================================
 * REGISTER VENDOR VALIDATION
 * =======================================================
 * 
 * POST /vendors/register
 * 
 * Why these rules?
 * - companyName: 3-100 chars, trimmed
 * - companySlug: lowercase, numbers, hyphens only (for URL)
 * - adminEmail: valid email format
 * - adminPassword: strong password (min 6 chars with complexity)
 */
export const registerVendorValidation = z.object({
  body: z.object({
    companyName: z
      .string()
      .min(3, "Company name must be at least 3 characters")
      .max(100, "Company name must not exceed 100 characters")
      .trim(),
    
    companySlug: slugSchema,
    
    adminEmail: emailSchema,
    
    adminPassword: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password must not exceed 100 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      )
  })
});

/**
 * =======================================================
 * UPDATE VENDOR PROFILE VALIDATION
 * =======================================================
 * 
 * PATCH /vendors/me
 */
export const updateVendorValidation = z.object({
  body: z.object({
    name: z
      .string()
      .min(3, "Company name must be at least 3 characters")
      .max(100, "Company name must not exceed 100 characters")
      .trim()
      .optional(),
    
    status: z
      .enum(['active', 'suspended'])
      .optional()
  })
});

/**
 * =======================================================
 * INVITE STAFF VALIDATION
 * =======================================================
 * 
 * POST /vendor/users/invite
 */
export const inviteStaffValidation = z.object({
  body: z.object({
    email: emailSchema,
    role: z.enum(['vendor_staff', 'vendor_admin'], {
      errorMap: () => ({ message: "Role must be vendor_staff or vendor_admin" })
    })
  })
});

/**
 * =======================================================
 * UPDATE STAFF ROLE VALIDATION
 * =======================================================
 * 
 * PATCH /vendor/users/:id/role
 */
export const updateStaffRoleValidation = z.object({
  params: z.object({
    id: uuidSchema
  }),
  body: z.object({
    role: z.enum(['vendor_staff', 'vendor_admin'])
  })
});