// src/repository/products.repo.ts
import pool from "../db/database";
import { Product, Variant, CreateProductInput, UpdateProductInput } from "../types/product.types";

export async function findProductsByOrganization(
  organizationId: string,
  options?: {
    active?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<Product[]> {
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