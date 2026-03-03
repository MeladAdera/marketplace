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
    note: z.string().max(500).optional(), // ملاحظة اختيارية للـ Audit
  }),
});