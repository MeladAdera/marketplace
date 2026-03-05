import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// 🔹 GET /vendor/statistics - VALIDATION
// ─────────────────────────────────────────────────────────────

export const getVendorStatisticsSchema = z.object({
  query: z.object({
    period: z.enum([
      'today', 'week', 'month', 'quarter', 'year', 'custom'
    ]).optional().default('month'),
    
    from_date: z.string()
      .datetime({ offset: true })
      .optional()
      .transform((val) => val ? new Date(val) : undefined),
    
    to_date: z.string()
      .datetime({ offset: true })
      .optional()
      .transform((val) => val ? new Date(val) : undefined),
  })
  .refine((data) => {
    // If custom period, both dates are required
    if (data.period === 'custom') {
      return !!data.from_date && !!data.to_date;
    }
    return true;
  }, {
    message: "from_date and to_date are required when period is 'custom'",
    path: ["from_date"],
  }),
});

// ─────────────────────────────────────────────────────────────
// 🔹 GET /vendor/users - VALIDATION
// ─────────────────────────────────────────────────────────────

export const listVendorUsersSchema = z.object({
  query: z.object({
    role: z.enum(['vendor_admin', 'vendor_staff']).optional(),
    
    active: z.string()
      .optional()
      .transform((val) => {
        if (val === 'true') return true;
        if (val === 'false') return false;
        return undefined;
      }),
    
    search: z.string()
      .max(100, "Search query too long")
      .optional(),
    
    page: z.string()
      .regex(/^\d+$/, "Page must be a number")
      .transform(Number)
      .default("1"),
    
    limit: z.string()
      .regex(/^\d+$/, "Limit must be a number")
      .transform((val) => {
        const num = Number(val);
        // Cap between 1 and 100
        return Math.min(100, Math.max(1, num));
      })
      .default("20"),
  }),
});



// ─────────────────────────────────────────────────────────────
// 🔹 EXPORT ALL SCHEMAS (for easy import in routes)
// ─────────────────────────────────────────────────────────────

export const vendorAdminValidations = {
  getVendorStatistics: getVendorStatisticsSchema,
  listVendorUsers: listVendorUsersSchema,
};
// ─────────────────────────────────────────────────────────────
// 🔹 GET /vendor/users/:id - VALIDATION
// ─────────────────────────────────────────────────────────────

export const getVendorUserSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
});
// ─────────────────────────────────────────────────────────────
// 🔹 PATCH /vendor/users/:id/block - VALIDATION
// ─────────────────────────────────────────────────────────────

export const blockUserSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
  body: z.object({
    blocked: z.boolean({
      errorMap: () => ({ message: "'blocked' must be a boolean (true or false)" })
    }),
    reason: z.string()
      .max(500, "Reason cannot exceed 500 characters")
      .optional()
      .or(z.literal("")).optional(),  // Allow empty string
  }),
});
// ─────────────────────────────────────────────────────────────
// 🔹 PATCH /vendor/users/:id/role - VALIDATION
// ⚠️ Only allows downgrade to 'vendor_staff' (security)
// ─────────────────────────────────────────────────────────────

export const updateUserRoleSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
  body: z.object({
    newRole: z.literal('vendor_staff', {
      errorMap: () => ({ 
        message: "Can only change role to 'vendor_staff'. Contact platform admin for role elevation." 
      })
    }),
    reason: z.string()
      .max(500, "Reason cannot exceed 500 characters")
      .optional()
      .or(z.literal("")).optional(),
  }),
});