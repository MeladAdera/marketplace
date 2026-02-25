// src/repository/public-products.repo.ts
import pool from "../db/database";
import { 
  PublicProductFilters, 
  PublicProductSummary, 
  PublicProductDetail,
  PublicVariant 
} from "../types/product.types";

/**
 * List ALL public products (from ALL active vendors)
 * 🔒 No organization filter (Marketplace mode)
 */
export async function listPublicProducts(
  filters: PublicProductFilters
): Promise<{ products: PublicProductSummary[]; total: number }> {

  const { page, limit, vendorSlug, minPrice, maxPrice, search } = filters;
  const offset = (page - 1) * limit;

  const whereConditions: string[] = [
    "p.active = TRUE",
    "p.soft_deleted_at IS NULL",
    "o.status = 'active'",
    "v.active = TRUE"
  ];

  const params: any[] = [];
  let paramIndex = 1;

  // Optional filters (NOT organization_id)

  if (vendorSlug) {
    whereConditions.push(`o.slug = $${paramIndex}`);
    params.push(vendorSlug);
    paramIndex++;
  }

  if (minPrice !== undefined) {
    whereConditions.push(`v.price_cents >= $${paramIndex}`);
    params.push(minPrice);
    paramIndex++;
  }

  if (maxPrice !== undefined) {
    whereConditions.push(`v.price_cents <= $${paramIndex}`);
    params.push(maxPrice);
    paramIndex++;
  }

  if (search) {
    whereConditions.push(`
      (p.name ILIKE $${paramIndex}
       OR p.description ILIKE $${paramIndex})
    `);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = whereConditions.join(" AND ");

  // Main Query (Marketplace Mode)
  const productsQuery = `
    SELECT
      p.id,
      p.name,
      p.description,
      p.created_at,
      o.id as vendor_id,
      o.name as vendor_name,
      o.slug as vendor_slug,
      MIN(v.price_cents) as min_price,
      MAX(v.price_cents) as max_price,
      COUNT(v.id) as variant_count,
      BOOL_OR(v.stock_quantity > 0) as has_stock
    FROM products p
    INNER JOIN organizations o ON p.organization_id = o.id
    INNER JOIN variants v ON v.product_id = p.id
    WHERE ${whereClause}
    GROUP BY
      p.id,
      p.name,
      p.description,
      p.created_at,
      o.id,
      o.name,
      o.slug
    ORDER BY p.created_at DESC
    LIMIT $${paramIndex}
    OFFSET $${paramIndex + 1}
  `;

  const productsParams = [...params, limit, offset];
  const productsResult = await pool.query(productsQuery, productsParams);

  // Count for pagination
  const countQuery = `
    SELECT COUNT(DISTINCT p.id) as total
    FROM products p
    INNER JOIN organizations o ON p.organization_id = o.id
    INNER JOIN variants v ON v.product_id = p.id
    WHERE ${whereClause}
  `;

  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0].total);

  const products = productsResult.rows.map((row): PublicProductSummary => ({
    id: row.id,
    name: row.name,
    description: row.description,
    vendor: {
      id: row.vendor_id,
      name: row.vendor_name,
      slug: row.vendor_slug,
    },
    price_range: {
      min: parseInt(row.min_price),
      max: parseInt(row.max_price),
    },
    variant_count: parseInt(row.variant_count),
    has_stock: row.has_stock,
    created_at: row.created_at.toISOString(),
  }));

  return { products, total };
}

/**
 * Get single public product by ID with all active variants
 * 🔒 Enforces: active product, non-deleted, active vendor, active variants only
 */
export async function getPublicProductById(
  productId: string
): Promise<PublicProductDetail | null> {
  // 1️⃣ Verify product is public + get vendor info
  const productQuery = `
    SELECT 
      p.id,
      p.name,
      p.description,
      p.created_at,
      p.updated_at,
      o.id as vendor_id,
      o.name as vendor_name,
      o.slug as vendor_slug
    FROM products p
    INNER JOIN organizations o ON p.organization_id = o.id
    WHERE p.id = $1
      AND p.active = TRUE
      AND p.soft_deleted_at IS NULL
      AND o.status = 'active'
  `;

  const productResult = await pool.query(productQuery, [productId]);
  if (!productResult.rows[0]) return null;

  const product = productResult.rows[0];

  // 2️⃣ Get all active variants
  const variantsQuery = `
    SELECT 
      id,
      name,
      sku,
      price_cents,
      stock_quantity,
      active
    FROM variants
    WHERE product_id = $1
      AND active = TRUE
    ORDER BY created_at ASC
  `;

  const variantsResult = await pool.query(variantsQuery, [productId]);

  const variants = variantsResult.rows.map((v: any): PublicVariant => ({
    id: v.id,
    name: v.name,
    sku: v.sku,
    price_cents: v.price_cents,
    stock_quantity: v.stock_quantity,
    active: v.active,
  }));

  // ⚠️ Business rule: No active variants = product not found
  if (variants.length === 0) return null;

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    vendor: {
      id: product.vendor_id,
      name: product.vendor_name,
      slug: product.vendor_slug,
    },
    variants,
    created_at: product.created_at.toISOString(),
    updated_at: product.updated_at.toISOString(),
  };
}