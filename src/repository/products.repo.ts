// src/repository/products.repo.ts
import pool from "../db/database";
import { Product, Variant, CreateProductInput, UpdateProductInput, CreateVariantInput } from "../types/product.types";
let queryCount = 0;

export async function findProductsByOrganization(
  organizationId: string,
  options?: {
    active?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<Product[]> {

  queryCount++;
  console.log(`🔍 Query #${queryCount}: Fetching Products`);
  let query = `
    SELECT
      id,
      organization_id,
      name,
      description,
      active,
      soft_deleted_at,
      created_at,
      updated_at
    FROM products
    WHERE organization_id = $1
  `;
  
  const params: any[] = [organizationId];
  let paramCounter = 2;

  if (options?.active !== undefined) {
    query += ` AND active = $${paramCounter}`;
    params.push(options.active);
    paramCounter++;
  }

  if (options?.search) {
    query += ` AND (name ILIKE $${paramCounter} OR description ILIKE $${paramCounter})`;
    params.push(`%${options.search}%`);
    paramCounter++;
  }

  query += ` AND soft_deleted_at IS NULL`;
  query += ` ORDER BY created_at DESC`;

  if (options?.limit) {
    query += ` LIMIT $${paramCounter}`;
    params.push(options.limit);
    paramCounter++;
  }

  if (options?.offset) {
    query += ` OFFSET $${paramCounter}`;
    params.push(options.offset);
  }

  const result = await pool.query<Product>(query, params);
  return result.rows;
}

export async function countProductsByOrganization(
  organizationId: string,
  options?: { active?: boolean; search?: string }
): Promise<number> {
  let query = `
    SELECT COUNT(*) as count
    FROM products
    WHERE organization_id = $1 AND soft_deleted_at IS NULL
  `;
  
  const params: any[] = [organizationId];
  let paramCounter = 2;

  if (options?.active !== undefined) {
    query += ` AND active = $${paramCounter}`;
    params.push(options.active);
    paramCounter++;
  }

  if (options?.search) {
    query += ` AND (name ILIKE $${paramCounter} OR description ILIKE $${paramCounter})`;
    params.push(`%${options.search}%`);
    paramCounter++;
  }

  const result = await pool.query(query, params);
  return parseInt(result.rows[0].count);
}

export async function findVariantsByProductId(productId: string): Promise<Variant[]> {

  queryCount++;
  console.log(`🔍 Query #${queryCount}: Fetching Variants for ${productId.length} products`);
  const query = `
    SELECT
      id,
      product_id,
      sku,
      name,
      price_cents,
      stock_quantity,
      active,
      created_at,
      updated_at
    FROM variants
    WHERE product_id = $1 AND active = true
    ORDER BY created_at ASC
  `;

  const result = await pool.query<Variant>(query, [productId]);
  return result.rows;
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const query = `
    INSERT INTO products (
      id,
      organization_id,
      name,
      description,
      active,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      $4,
      NOW(),
      NOW()
    )
    RETURNING
      id,
      organization_id,
      name,
      description,
      active,
      soft_deleted_at,
      created_at,
      updated_at
  `;

  const result = await pool.query<Product>(query, [
    input.organizationId,
    input.name,
    input.description || null,
    input.active !== undefined ? input.active : true
  ]);

  return result.rows[0];
}
export async function findProductById(
  id: string,
  organizationId?: string
): Promise<(Product & { variants: Variant[] }) | null> {
  let query = `
    SELECT
      id,
      organization_id,
      name,
      description,
      active,
      soft_deleted_at,
      created_at,
      updated_at
    FROM products
    WHERE id = $1
  `;
  
  const params: any[] = [id];
  
  if (organizationId) {
    query += ` AND organization_id = $2`;
    params.push(organizationId);
  }

  query += ` AND soft_deleted_at IS NULL`;

  const result = await pool.query<Product>(query, params);
  
  if (result.rows.length === 0) {
    return null;
  }

  const product = result.rows[0];
  const variants = await findVariantsByProductId(id);

  return {
    ...product,
    variants
  };
}

export async function updateProduct(
  id: string,
  organizationId: string,
  input: UpdateProductInput
): Promise<Product | null> {
  // Build dynamic update query
  const updates: string[] = [];
  const params: any[] = [];
  let paramCounter = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramCounter}`);
    params.push(input.name);
    paramCounter++;
  }

  if (input.description !== undefined) {
    updates.push(`description = $${paramCounter}`);
    params.push(input.description);
    paramCounter++;
  }

  if (input.active !== undefined) {
    updates.push(`active = $${paramCounter}`);
    params.push(input.active);
    paramCounter++;
  }

  if (input.softDeletedAt !== undefined) {
    updates.push(`soft_deleted_at = $${paramCounter}`);
    params.push(input.softDeletedAt);
    paramCounter++;
  }

  updates.push(`updated_at = NOW()`);

  const query = `
    UPDATE products
    SET ${updates.join(', ')}
    WHERE id = $${paramCounter} AND organization_id = $${paramCounter + 1} AND soft_deleted_at IS NULL
    RETURNING
      id,
      organization_id,
      name,
      description,
      active,
      soft_deleted_at,
      created_at,
      updated_at
  `;

  params.push(id, organizationId);

  const result = await pool.query<Product>(query, params);
  return result.rows[0] || null;
}

export async function softDeleteProduct(
  id: string,
  organizationId: string
): Promise<boolean> {
  const query = `
    UPDATE products
    SET soft_deleted_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND organization_id = $2 AND soft_deleted_at IS NULL
    RETURNING id
  `;

  const result = await pool.query(query, [id, organizationId]);
  return result.rows.length > 0;
}

export async function createVariant(
  input: CreateVariantInput
): Promise<Variant> {
  // ✅ Check for duplicate SKU within the same organization
  const skuCheck = await pool.query(
    `SELECT v.id 
     FROM variants v
     JOIN products p ON p.id = v.product_id
     WHERE v.sku = $1 AND p.organization_id = $2`,
    [input.sku, input.organizationId]
  );

  if (skuCheck.rows.length > 0) {
    throw new Error(`duplicate key value violates unique constraint "variants_sku_organization_unique"`);
  }

  const query = `
    INSERT INTO variants (
      id,
      product_id,
      sku,
      name,
      price_cents,
      stock_quantity,
      active,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      NOW(),
      NOW()
    )
    RETURNING
      id,
      product_id,
      sku,
      name,
      price_cents,
      stock_quantity,
      active,
      created_at,
      updated_at
  `;

  const result = await pool.query<Variant>(query, [
    input.productId,
    input.sku,
    input.name || null,
    input.priceCents,
    input.stockQuantity || 0,
    input.active !== undefined ? input.active : true
  ]);

  return result.rows[0];
}


export async function createVariants(
  variants: CreateVariantInput[]
): Promise<Variant[]> {
  if (variants.length === 0) return [];
  
  const results: Variant[] = [];
  for (const variant of variants) {
    const result = await createVariant(variant);
    results.push(result);
  }
  return results;
}
/**
 * Find variants for multiple products at once (Prevents N+1)
 */
export async function findVariantsByProductIds(productIds: string[]) {
  if (productIds.length === 0) return [];

  const { rows } = await pool.query(
    `SELECT * FROM variants WHERE product_id = ANY($1)`,
    [productIds]
  );

  return rows;
}