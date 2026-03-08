import pool from "../db/database";
import { PoolClient } from "pg";
import {
  Product,
  Variant,
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput
} from "../types/product.types";

function getDb(client?: PoolClient) {
  return client ?? pool;
}

/**
 * FIND PRODUCTS
 */
export async function findProductsByOrganization(
  organizationId: string,
  options?: {
    active?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  },
  client?: PoolClient
): Promise<Product[]> {

  const db = getDb(client);

  let query = `
    SELECT *
    FROM products
    WHERE organization_id = $1
    AND soft_deleted_at IS NULL
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

  const result = await db.query<Product>(query, params);
  return result.rows;
}

/**
 * COUNT PRODUCTS
 */
export async function countProductsByOrganization(
  organizationId: string,
  options?: { active?: boolean; search?: string },
  client?: PoolClient
): Promise<number> {

  const db = getDb(client);

  let query = `
    SELECT COUNT(*) as count
    FROM products
    WHERE organization_id = $1
    AND soft_deleted_at IS NULL
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

  const result = await db.query(query, params);
  return parseInt(result.rows[0].count);
}

/**
 * CREATE PRODUCT
 */
export async function createProduct(
  input: CreateProductInput,
  client?: PoolClient
): Promise<Product> {

  const db = getDb(client);

  const result = await db.query<Product>(
    `
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
      $1,$2,$3,$4,NOW(),NOW()
    )
    RETURNING *
  `,
    [
      input.organizationId,
      input.name,
      input.description || null,
      input.active ?? true
    ]
  );

  return result.rows[0];
}

/**
 * CREATE VARIANT
 */
export async function createVariant(
  input: CreateVariantInput,
  client?: PoolClient
): Promise<Variant> {

  const variants = await createVariants([input], client);
  return variants[0];
}

/**
 * CREATE MULTIPLE VARIANTS
 */
export async function createVariants(
  variants: CreateVariantInput[],
  client?: PoolClient
): Promise<Variant[]> {

  if (!variants.length) return [];

  const db = getDb(client);

  const values: string[] = [];
  const params: any[] = [];

  variants.forEach((variant, index) => {

    const base = index * 6;

    values.push(
      `(gen_random_uuid(),$${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},NOW(),NOW())`
    );

    params.push(
      variant.productId,
      variant.sku,
      variant.name || null,
      variant.priceCents,
      variant.stockQuantity ?? 0,
      variant.active ?? true
    );
  });

  const result = await db.query<Variant>(
    `
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
    VALUES ${values.join(",")}
    RETURNING *
  `,
    params
  );

  return result.rows;
}

/**
 * FIND VARIANTS BY PRODUCT IDS
 */
export async function findVariantsByProductIds(
  productIds: string[],
  client?: PoolClient
): Promise<Variant[]> {

  if (!productIds.length) return [];

  const db = getDb(client);

  const result = await db.query<Variant>(
    `
    SELECT *
    FROM variants
    WHERE product_id = ANY($1)
    AND active = true
    ORDER BY created_at ASC
  `,
    [productIds]
  );

  return result.rows;
}

/**
 * FIND VARIANTS BY PRODUCT ID
 */
export async function findVariantsByProductId(
  productId: string,
  client?: PoolClient
): Promise<Variant[]> {

  const db = getDb(client);

  const result = await db.query<Variant>(
    `
    SELECT *
    FROM variants
    WHERE product_id = $1
    AND active = true
    ORDER BY created_at ASC
  `,
    [productId]
  );

  return result.rows;
}

/**
 * FIND PRODUCT BY ID
 */
export async function findProductById(
  id: string,
  organizationId?: string,
  client?: PoolClient
): Promise<(Product & { variants: Variant[] }) | null> {

  const db = getDb(client);

  let query = `
    SELECT *
    FROM products
    WHERE id = $1
    AND soft_deleted_at IS NULL
  `;

  const params: any[] = [id];

  if (organizationId) {
    query += ` AND organization_id = $2`;
    params.push(organizationId);
  }

  const result = await db.query<Product>(query, params);

  if (!result.rows.length) return null;

  const product = result.rows[0];
  const variants = await findVariantsByProductId(id, client);

  return { ...product, variants };
}

/**
 * UPDATE PRODUCT
 */
export async function updateProduct(
  id: string,
  organizationId: string,
  input: UpdateProductInput,
  client?: PoolClient
): Promise<Product | null> {

  const db = getDb(client);

  const updates: string[] = [];
  const params: any[] = [];
  let paramCounter = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramCounter++}`);
    params.push(input.name);
  }

  if (input.description !== undefined) {
    updates.push(`description = $${paramCounter++}`);
    params.push(input.description);
  }

  if (input.active !== undefined) {
    updates.push(`active = $${paramCounter++}`);
    params.push(input.active);
  }

  updates.push(`updated_at = NOW()`);

  const query = `
    UPDATE products
    SET ${updates.join(",")}
    WHERE id = $${paramCounter}
    AND organization_id = $${paramCounter + 1}
    AND soft_deleted_at IS NULL
    RETURNING *
  `;

  params.push(id, organizationId);

  const result = await db.query<Product>(query, params);

  return result.rows[0] || null;
}

/**
 * SOFT DELETE PRODUCT
 */
export async function softDeleteProduct(
  id: string,
  organizationId: string,
  client?: PoolClient
): Promise<boolean> {

  const db = getDb(client);

  const result = await db.query(
    `
    UPDATE products
    SET soft_deleted_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND organization_id = $2
    RETURNING id
  `,
    [id, organizationId]
  );

  return result.rows.length > 0;
}