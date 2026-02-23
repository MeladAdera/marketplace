// src/repository/inventory.repo.ts
import pool from "../db/database";
import { Variant } from "../types/product.types";
import { InventoryMovement, CreateInventoryMovementInput } from "../types/inventory.types";
import { InventoryMovementType } from "../types/common.types"; // Ensure this exists based on your SQL constraint

/**
 * 🔒 Locks the variant row to prevent concurrent updates.
 * Must be called inside a transaction.
 */
export async function getVariantForUpdate(
  variantId: string,
  organizationId: string
): Promise<Pick<Variant, 'id' | 'stockQuantity' | 'sku'> | null> {
  const query = `
    SELECT 
      v.id, 
      v.stock_quantity as "stockQuantity", 
      v.sku 
    FROM variants v
    INNER JOIN products p ON v.product_id = p.id
    WHERE v.id = $1 
      AND p.organization_id = $2 
      AND p.soft_deleted_at IS NULL
    FOR UPDATE
  `;

  const result = await pool.query(query, [variantId, organizationId]);
  return result.rows[0] || null;
}

/**
 * 📝 Updates the stock quantity on the variants table.
 * Must be called inside a transaction.
 */
export async function updateVariantStock(
  variantId: string,
  organizationId: string,
  newStockQuantity: number
): Promise<Pick<Variant, 'id' | 'stockQuantity' | 'updatedAt'> | null> {
  const query = `
    UPDATE variants v
    SET 
      stock_quantity = $1, 
      updated_at = NOW() 
    FROM products p
    WHERE v.product_id = p.id 
      AND v.id = $2 
      AND p.organization_id = $3 
    RETURNING 
      v.id, 
      v.stock_quantity as "stockQuantity", 
      v.updated_at as "updatedAt"
  `;

  const result = await pool.query(query, [newStockQuantity, variantId, organizationId]);
  return result.rows[0] || null;
}

/**
 * 📜 Records an inventory movement log.
 * Must be called inside a transaction.
 */
export async function createInventoryMovement(
  input: CreateInventoryMovementInput
): Promise<InventoryMovement> {
  const query = `
    INSERT INTO inventory_movements (
      id,
      organization_id,
      variant_id,
      actor_user_id,
      type,
      quantity_change,
      reason,
      related_vendor_order_id,
      created_at
    )
    VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      NOW()
    )
    RETURNING *
  `;

  const result = await pool.query<InventoryMovement>(query, [
    input.organizationId,
    input.variantId,
    input.actorUserId || null,
    input.type,
    input.quantityChange,
    input.reason || null,
    input.relatedVendorOrderId || null
  ]);

  return result.rows[0];
}

/**
 * 📋 Get inventory movement history WITH variant, product & actor details
 */
export async function getInventoryMovementsWithDetails(
  organizationId: string,
  variantId?: string,
  limit: number = 20,
  offset: number = 0
): Promise<any[]> {
  let query = `
    SELECT 
      im.id,
      im.type,
      im.quantity_change as "quantityChange",
      im.reason,
      im.created_at as "createdAt",
      im.variant_id as "variantId",
      im.actor_user_id as "actorUserId",
      v.sku as "variantSku",
      v.name as "variantName",
      p.id as "productId",
      p.name as "productName",
      u.id as "actorId",
      u.email as "actorEmail",
      u.role as "actorRole"
    FROM inventory_movements im
    INNER JOIN variants v ON im.variant_id = v.id
    INNER JOIN products p ON v.product_id = p.id
    LEFT JOIN users u ON im.actor_user_id = u.id
    WHERE p.organization_id = $1
  `;
  
  const params: any[] = [organizationId];
  let paramCounter = 2;

  if (variantId) {
    query += ` AND im.variant_id = $${paramCounter}`;
    params.push(variantId);
    paramCounter++;
  }

  query += ` ORDER BY im.created_at DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
}