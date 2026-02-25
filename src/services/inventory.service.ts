// src/services/inventory.service.ts
import pool from "../db/database";
import {
  getVariantForUpdate,
  getVariantById,
  updateVariantStock,
  createInventoryMovement,
  getInventoryMovementsWithDetails
} from "../repository/inventory.repo";
import { createAuditLog } from "../repository/audit.repo";
import { PoolClient } from "pg";
import {
  InsufficientStockError,
  VariantNotFoundError
} from "../errors/inventory.errors";
import { StockUpdateInput } from "../types/inventory.types";

/**
 * 📦 Update Stock (Transaction Safe)
 */
export async function updateStockService(
  organizationId: string,
  userId: string,
  input: StockUpdateInput
) {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    const variant = await getVariantForUpdate(
      client,
      input.variantId,
      organizationId
    );

    if (!variant) {
      throw new VariantNotFoundError(input.variantId);
    }

    const oldStock = variant.stockQuantity;
    const newStock = input.quantity;

    if (newStock < 0) {
      throw new InsufficientStockError(
        `Stock cannot be negative. Requested: ${newStock}`
      );
    }

    const quantityChange = newStock - oldStock;

    await updateVariantStock(
      client,
      input.variantId,
      organizationId,
      newStock
    );

    await createInventoryMovement(client, {
      organizationId,
      variantId: input.variantId,
      actorUserId: userId,
      type: "manual_adjustment",
      quantityChange,
      reason:
        input.reason || "Manual stock update via vendor dashboard",
      relatedVendorOrderId: null
    });

    // ⚠️ IMPORTANT: audit log should also accept client if you want it atomic
    await createAuditLog({
      actorUserId: userId,
      organizationId,
      action: "INVENTORY_UPDATED",
      entityType: "variant",
      entityId: input.variantId,
      oldValues: { stockQuantity: oldStock },
      newValues: { stockQuantity: newStock }
    });

    await client.query("COMMIT");

    return {
      variantId: input.variantId,
      oldStock,
      newStock,
      change: quantityChange
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * ✅ Check Stock (NO LOCK)
 */
export async function checkStockAvailabilityService(
  organizationId: string,
  variantId: string,
  requestedQuantity: number
) {
  const variant = await getVariantById(
    variantId,
    organizationId
  );

  if (!variant) {
    throw new VariantNotFoundError(variantId);
  }

  return {
    variantId,
    available: variant.stockQuantity >= requestedQuantity,
    currentStock: variant.stockQuantity,
    requestedQuantity
  };
}

/**
 * 📋 Inventory History
 */
export async function getInventoryHistoryService(
  organizationId: string,
  variantId?: string,
  page: number = 1,
  limit: number = 20
) {
  const movements = await getInventoryMovementsWithDetails(
    organizationId,
    variantId,
    limit,
    (page - 1) * limit
  );

  return {
    movements,
    pagination: {
      page,
      limit,
      total: movements.length,
      totalPages: Math.ceil(movements.length / limit)
    }
  };
}