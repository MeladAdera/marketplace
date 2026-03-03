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
