// ==========================================
// src/errors/product.errors.ts
// ==========================================

import { AppError } from './AppError';

/**
 * خطأ: المنتج غير موجود
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
      productId ? { productId } : undefined
    );
  }
}

/**
 * خطأ: الـ variant غير موجود
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
      variantId ? { variantId } : undefined
    );
  }
}

/**
 * خطأ: المخزون غير كافي
 */
export class InsufficientStockError extends AppError {
  constructor(variantId: string | number, requested: number, available: number) {
    super(
      `Insufficient stock for variant ${variantId}. Requested: ${requested}, Available: ${available}`,
      400,
      'INSUFFICIENT_STOCK',
      true,
      { variantId, requested, available }
    );
  }
}

/**
 * خطأ: المنتج غير نشط
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
      productId ? { productId } : undefined
    );
  }
}

/**
 * خطأ: SKU موجود مسبقاً
 */
export class DuplicateSkuError extends AppError {
  constructor(sku: string) {
    super(
      `SKU "${sku}" already exists`,
      409,
      'DUPLICATE_SKU',
      true,
      { sku }
    );
  }
}