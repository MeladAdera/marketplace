import { z } from "zod";

export const listVendorOrdersSchema = z.object({
  query: z.object({
    status: z.enum([
      'pending', 'accepted', 'packed', 'shipped', 
      'delivered', 'cancelled', 'refunded'
    ]).optional(),
    from_date: z.string().datetime().optional(),
    to_date: z.string().datetime().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default("1"),
    limit: z.string().regex(/^\d+$/).transform(Number).default("20"),
  }),
});
export const updateOrderStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid order ID format"),
  }),
  body: z.object({
    newStatus: z.enum([
      'pending', 'accepted', 'packed', 'shipped', 
      'delivered', 'cancelled', 'refunded'
    ], {
      errorMap: () => ({ message: "Invalid status value" })
    }),
    note: z.string().max(500).optional(), 
  }),
});
// ─────────────────────────────────────────────────────────────
// 🔹 STATISTICS VALIDATION
// ─────────────────────────────────────────────────────────────

export const getVendorStatisticsSchema = z.object({
  query: z.object({
    period: z.enum(['today', 'week', 'month', 'quarter', 'year', 'custom']).optional(),
    from_date: z.string().datetime().optional(),
    to_date: z.string().datetime().optional(),
  }).refine((data) => {
    // If custom period, both dates required
    if (data.period === 'custom') {
      return !!data.from_date && !!data.to_date;
    }
    return true;
  }, {
    message: "from_date and to_date are required for custom period",
    path: ["from_date"],
  }),
});

// ─────────────────────────────────────────────────────────────
// 🔹 VENDOR USER LIST VALIDATION
// ─────────────────────────────────────────────────────────────

export const listVendorUsersSchema = z.object({
  query: z.object({
    role: z.enum(['vendor_admin', 'vendor_staff']).optional(),
    active: z.string().transform((val) => val === 'true').optional(),
    search: z.string().max(100).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default("1"),
    limit: z.string().regex(/^\d+$/).transform(Number).default("20"),
  }),
});

// ─────────────────────────────────────────────────────────────
// 🔹 INVITE VENDOR USER VALIDATION
// ─────────────────────────────────────────────────────────────

export const inviteVendorUserSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    role: z.enum(['vendor_admin', 'vendor_staff'], {
      errorMap: () => ({ message: "Role must be 'vendor_admin' or 'vendor_staff'" })
    }),
    sendEmail: z.boolean().optional().default(true),
  }),
});