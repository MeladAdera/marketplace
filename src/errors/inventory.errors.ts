// src/errors/inventory.errors.ts
import { AppError } from "./AppError";

/**
 * ❌ Variant Not Found (404)
 */
export class VariantNotFoundError extends AppError {
  constructor(variantId: string) {
    super(
      `Variant not found: ${variantId}`,
      404,
      'VARIANT_NOT_FOUND',
      true,
      { variantId },
      'variant_not_found',
      { variantId }
    );
  }
}

/**
 * ❌ Insufficient Stock (400)
 */
export class InsufficientStockError extends AppError {
  constructor(
    message: string,
    details?: {
      variantId?: string;
      requested?: number;
      available?: number;
    }
  ) {
    super(
      message,
      400,
      'INSUFFICIENT_STOCK',
      true,
      details,
      'insufficient_stock',
      details
    );
  }
}

/**
 * ❌ Invalid Stock Quantity (400)
 */
export class InvalidStockQuantityError extends AppError {
  constructor(message: string = 'Invalid stock quantity') {
    super(
      message,
      400,
      'INVALID_STOCK_QUANTITY',
      true,
      {},
      'invalid_stock_quantity'
    );
  }
}

/**
 * ❌ Inventory Movement Failed (500)
 */
export class InventoryMovementError extends AppError {
  constructor(message: string = 'Failed to record inventory movement') {
    super(
      message,
      500,
      'INVENTORY_MOVEMENT_FAILED',
      true,
      {},
      'inventory_movement_failed'
    );
  }
}