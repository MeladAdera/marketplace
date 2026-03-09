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

// ─────────────────────────────────────────────────────────────────────────
// PLATFORM ADMIN - VENDOR MANAGEMENT VALIDATIONS
// ─────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/vendors
 */
export const listAdminVendorsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['active', 'suspended', 'deleted']).optional(),
    search: z.string().trim().max(100).optional(),
    sortBy: z.enum(['created_at', 'name', 'status']).default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

/**
 * PATCH /admin/vendors/:id
 */
export const updateAdminVendorSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    name: z
      .string()
      .min(3, "Company name must be at least 3 characters")
      .max(100, "Company name must not exceed 100 characters")
      .trim()
      .optional(),
    slug: slugSchema.optional(),
    // ✅ contact_email و phone: أزلناها مؤقتاً، يمكن إضافتها لاحقاً عند دعمها في الـ Service
  })
});

/**
 * PATCH /admin/vendors/:id/suspend
 */
export const suspendVendorSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    reason: z
      .string()
      .min(10, "Reason must be at least 10 characters")
      .max(500, "Reason must not exceed 500 characters")
      .trim(),
    duration_hours: z.coerce.number().int().min(1).max(720).optional(), // 1h to 30 days
  }),
});

/**
 * PATCH /admin/vendors/:id/activate
 */
export const activateVendorSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    note: z
      .string()
      .max(500, "Note must not exceed 500 characters")
      .optional(),
  }),
});

/**
 * DELETE /admin/vendors/:id
 */
export const deleteVendorSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    confirm: z.literal(true, {
      errorMap: () => ({ message: "Must confirm deletion with { confirm: true }" }),
    }),
  }),
});
export const vendorIdParamsSchema = z.object({
  id: uuidSchema,  // ← تأكد أن uuidSchema مُستورد من common.validation.ts
});
export const restoreVendorSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z
    .object({
      note: z.string().max(500).optional(),
    })
    .optional(),
});