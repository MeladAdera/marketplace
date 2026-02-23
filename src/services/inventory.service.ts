// src/services/inventory.service.ts
import pool from "../db/database";
import {
  getVariantForUpdate,
  updateVariantStock,
  createInventoryMovement,
  getInventoryMovementsWithDetails 
} from "../repository/inventory.repo";
import { createAuditLog } from "../repository/audit.repo";
import { StockUpdateInput, InventoryMovementResponse } from "../types/inventory.types";
import {
  InsufficientStockError,
  VariantNotFoundError
} from "../errors/inventory.errors";

/**
 * 📦 Update Stock for a Single Variant
 */
export async function updateStockService(
  organizationId: string,
  userId: string,
  input: StockUpdateInput
): Promise<{
  variantId: string;
  oldStock: number;
  newStock: number;
  change: number;
}> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Lock the variant row (prevents concurrent updates)
    const variant = await getVariantForUpdate(input.variantId, organizationId);
    
    if (!variant) {
      throw new VariantNotFoundError(input.variantId);
    }

    const oldStock = variant.stockQuantity;
    const newStock = input.quantity;

    // 2️⃣ Validate: Prevent negative stock
    if (newStock < 0) {
      throw new InsufficientStockError(
        `Stock cannot be negative. Requested: ${newStock}`
      );
    }

    // 3️⃣ Calculate the change (delta)
    const quantityChange = newStock - oldStock;

    // 4️⃣ Update the variant stock
    const updated = await updateVariantStock(
      input.variantId,
      organizationId,
      newStock
    );

    if (!updated) {
      throw new VariantNotFoundError(input.variantId);
    }

    // 5️⃣ Record inventory movement (history)
    await createInventoryMovement({
      organizationId,
      variantId: input.variantId,
      actorUserId: userId,
      type: 'manual_adjustment',
      quantityChange,
      reason: input.reason || 'Manual stock update via vendor dashboard',
      relatedVendorOrderId: null
    });

    // 6️⃣ Record audit log (for compliance)
    await createAuditLog({
      actorUserId: userId,
      organizationId,
      action: "INVENTORY_UPDATED",
      entityType: "variant",
      entityId: input.variantId,
      oldValues: {
        stockQuantity: oldStock
      },
      newValues: {
        stockQuantity: newStock,
        reason: input.reason
      }
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
 * 📋 Get Inventory Movement History
 */
export async function getInventoryHistoryService(
  organizationId: string,
  variantId?: string,
  page: number = 1,
  limit: number = 20
): Promise<{
  movements: InventoryMovementResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const movements = await getInventoryMovementsWithDetails(
    organizationId,
    variantId,
    limit,
    (page - 1) * limit
  );

  return {
    movements: movements.map(m => ({
      id: m.id,
      type: m.type,
      quantityChange: m.quantityChange,
      reason: m.reason,
      createdAt: m.createdAt,
      variant: {
        id: m.variantId,
        sku: m.variantSku,           
        name: m.variantName,
        product: {
          id: m.productId,           
          name: m.productName     
        }
      },
      actor: m.actorId ? {           
        id: m.actorId,
        email: m.actorEmail,
        role: m.actorRole
      } : null
    })),
    pagination: {
      page,
      limit,
      total: movements.length,
      totalPages: Math.ceil(movements.length / limit)
    }
  };
}

/**
 * ✅ Check if Stock is Available (for cart/checkout)
 */
export async function checkStockAvailabilityService(
  organizationId: string,
  variantId: string,
  requestedQuantity: number
): Promise<{
  variantId: string;
  available: boolean;
  currentStock: number;
  requestedQuantity: number;
}> {
  const variant = await getVariantForUpdate(variantId, organizationId);

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