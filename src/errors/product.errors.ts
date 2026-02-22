// src/errors/product.errors.ts
import { AppError } from './AppError';

/**
 * Error: Product not found
 */
export class ProductNotFoundError extends AppError {
  constructor(productId?: string | number) {
    super(
      productId 
        ? `Product with ID ${productId} not found`
        : 'Product not found',
      404,
      'PRODUCT_NOT_FOUND',
      true,
      productId ? { productId } : undefined,
      'product.not_found',
      productId ? { productId } : undefined
    );
  }
}

/**
 * Error: Variant not found
 */
export class VariantNotFoundError extends AppError {
  constructor(variantId?: string | number) {
    super(
      variantId 
        ? `Variant with ID ${variantId} not found`
        : 'Variant not found',
      404,
      'VARIANT_NOT_FOUND',
      true,
      variantId ? { variantId } : undefined,
      'product.variant_not_found',
      variantId ? { variantId } : undefined
    );
  }
}

/**
 * Error: Insufficient stock
 */
export class InsufficientStockError extends AppError {
  constructor(variantId: string | number, requested: number, available: number) {
    super(
      `Insufficient stock for variant ${variantId}. Requested: ${requested}, Available: ${available}`,
      400,
      'INSUFFICIENT_STOCK',
      true,
      { variantId, requested, available },
      'product.insufficient_stock',
      { variantId, requested, available }
    );
  }
}

/**
 * Error: Product is not active
 */
export class ProductNotActiveError extends AppError {
  constructor(productId?: string | number) {
    super(
      productId 
        ? `Product with ID ${productId} is not active`
        : 'Product is not active',
      400,
      'PRODUCT_NOT_ACTIVE',
      true,
      productId ? { productId } : undefined,
      'product.not_active',
      productId ? { productId } : undefined
    );
  }
}

/**
 * Error: SKU already exists
 */
export class DuplicateSkuError extends AppError {
  constructor(sku: string) {
    super(
      `SKU "${sku}" already exists`,
      409,
      'DUPLICATE_SKU',
      true,
      { sku },
      'product.duplicate_sku',
      { sku }
    );
  }
}

/**
 * Error: Product create failed
 */
export class ProductCreateError extends AppError {
  constructor(details?: Record<string, any>) {
    super(
      'Failed to create product',
      500,
      'PRODUCT_CREATE_FAILED',
      true,
      details,
      'product.create_failed'
    );
  }
}

/**
 * Error: Product update failed
 */
export class ProductUpdateError extends AppError {
  constructor(details?: Record<string, any>) {
    super(
      'Failed to update product',
      500,
      'PRODUCT_UPDATE_FAILED',
      true,
      details,
      'product.update_failed'
    );
  }
}

/**
 * Error: Product delete failed
 */
export class ProductDeleteError extends AppError {
  constructor(details?: Record<string, any>) {
    super(
      'Failed to delete product',
      500,
      'PRODUCT_DELETE_FAILED',
      true,
      details,
      'product.delete_failed'
    );
  }
}

