// src/services/vendor/product.service.ts (Updated with error classes)

import pool from "../../db/database";
import {
  findProductById,
  findProductsByOrganization,
  countProductsByOrganization,
  createProduct,
  createVariants,
  updateProduct,
  softDeleteProduct,
  findVariantsByProductId,
  findVariantsByProductIds
} from "../../repository/products.repo";
import { createAuditLog } from "../../repository/audit.repo";
import {
  CreateProductInput,
  UpdateProductInput,
  ProductWithVariants,
  ProductFilters
} from "../../types/product.types";
import {
  ProductNotFoundError,
  VariantNotFoundError,
  DuplicateSkuError,
} from "../../errors/product.errors";

/**
 * 📦 CREATE PRODUCT + VARIANTS
 */
export async function createProductWithVariantsService(
  organizationId: string,
  input: {
    name: string;
    description?: string;
    active?: boolean;
    variants: Array<{
      sku: string;
      price: number;
      stock: number;
    }>;
  },
  userId: string
): Promise<ProductWithVariants> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ✅ Check for duplicate SKUs within the request
    const skus = input.variants.map(v => v.sku);
    const uniqueSkus = new Set(skus);
    if (skus.length !== uniqueSkus.size) {
      throw new DuplicateSkuError("Duplicate SKUs in request");
    }

    // 1️⃣ Create product
    const product = await createProduct({
      organizationId,
      name: input.name,
      description: input.description,
      active: input.active
    });

    // 2️⃣ Create variants
    const variants = await createVariants(
  input.variants.map(v => ({
    productId: product.id,
    organizationId, 
    sku: v.sku,
    priceCents: Math.round(v.price * 100),
    stockQuantity: v.stock,
    active: true
  }))
);

    // 3️⃣ Audit log
    await createAuditLog({
      actorUserId: userId,
      organizationId,
      action: "PRODUCT_CREATED",
      entityType: "product",
      entityId: product.id,
      newValues: {
        product: {
          name: product.name,
          description: product.description,
          active: product.active
        },
        variants: variants.map(v => ({
          sku: v.sku,
          priceCents: v.priceCents,
          stockQuantity: v.stockQuantity
        }))
      }
    });

    await client.query("COMMIT");

    return {
      id: product.id,
      organizationId: product.organizationId,
      name: product.name,
      description: product.description,
      active: product.active,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      variants: variants.map(v => ({
        id: v.id,
        productId: v.productId,
        sku: v.sku,
        name: v.name,
        priceCents: v.priceCents,
        stockQuantity: v.stockQuantity,
        active: v.active,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt
      }))
    };
  } catch (error) {
    await client.query("ROLLBACK");
    
    // ✅ Handle specific database errors (unique constraint violation for SKU)
    if (error instanceof Error && error.message.includes('duplicate key')) {
      throw new DuplicateSkuError("SKU already exists for this vendor");
    }
    
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 📋 GET PRODUCTS WITH PAGINATION
 */
/**
 * 📋 GET PRODUCTS WITH PAGINATION (Optimized)
 */
export async function getVendorProductsService(
  organizationId: string,
  filters: {
    page?: number;
    limit?: number;
    active?: boolean;
    search?: string;
  }
) {
  const { page = 1, limit = 10, active, search } = filters;
  const offset = (page - 1) * limit;

  // 1️⃣ Get products
  const products = await findProductsByOrganization(organizationId, {
    active,
    search,
    limit,
    offset
  });

  // 🚫 OLD CODE (N+1): Removed Promise.all map loop
  
  // 2️⃣ Get ALL variants for these products in ONE query
  const productIds = products.map(p => p.id);
  const allVariants = await findVariantsByProductIds(productIds);

  // 3️⃣ Map variants to their respective products in memory
  const productsWithVariants = products.map((product) => ({
    id: product.id,
    organizationId: product.organizationId,
    name: product.name,
    description: product.description,
    active: product.active,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    variants: allVariants
      .filter(v => v.product_id === product.id) // Match in memory
      .map(v => ({
        id: v.id,
        productId: v.productId,
        sku: v.sku,
        name: v.name,
        priceCents: v.priceCents,
        stockQuantity: v.stockQuantity,
        active: v.active,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt
      }))
  }));

  // 4️⃣ Get total count
  const total = await countProductsByOrganization(organizationId, {
    active,
    search
  });

  return {
    products: productsWithVariants,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrevious: page > 1
    }
  };
}

/**
 * 🔍 GET SINGLE PRODUCT
 */
export async function getVendorProductByIdService(
  organizationId: string,
  productId: string
): Promise<ProductWithVariants> {
  const product = await findProductById(productId, organizationId);
  
  if (!product) {
    throw new ProductNotFoundError(productId);
  }

  return {
    id: product.id,
    organizationId: product.organizationId,
    name: product.name,
    description: product.description,
    active: product.active,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    variants: product.variants.map(v => ({
      id: v.id,
      productId: v.productId,
      sku: v.sku,
      name: v.name,
      priceCents: v.priceCents,
      stockQuantity: v.stockQuantity,
      active: v.active,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt
    }))
  };
}

/**
 ✏️ UPDATE PRODUCT
 */
export async function updateProductService(
  organizationId: string,
  productId: string,
  input: UpdateProductInput,
  userId: string
): Promise<ProductWithVariants> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get old values for audit
    const oldProduct = await findProductById(productId, organizationId);
    if (!oldProduct) {
      throw new ProductNotFoundError(productId);
    }

    // Update product
    const updatedProduct = await updateProduct(productId, organizationId, input);
    if (!updatedProduct) {
      throw new ProductNotFoundError(productId);
    }

    // Get variants (unchanged for now)
    const variants = await findVariantsByProductId(productId);

    // Audit log
    await createAuditLog({
      actorUserId: userId,
      organizationId,
      action: "PRODUCT_UPDATED",
      entityType: "product",
      entityId: productId,
      oldValues: {
        name: oldProduct.name,
        description: oldProduct.description,
        active: oldProduct.active
      },
      newValues: {
        name: updatedProduct.name,
        description: updatedProduct.description,
        active: updatedProduct.active
      }
    });

    await client.query("COMMIT");

    return {
      id: updatedProduct.id,
      organizationId: updatedProduct.organizationId,
      name: updatedProduct.name,
      description: updatedProduct.description,
      active: updatedProduct.active,
      createdAt: updatedProduct.createdAt,
      updatedAt: updatedProduct.updatedAt,
      variants: variants.map(v => ({
        id: v.id,
        productId: v.productId,
        sku: v.sku,
        name: v.name,
        priceCents: v.priceCents,
        stockQuantity: v.stockQuantity,
        active: v.active,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt
      }))
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 🗑️ SOFT DELETE PRODUCT
 */
export async function deleteProductService(
  organizationId: string,
  productId: string,
  userId: string
): Promise<void> {
  const client = await pool.connect();

  console.log("===== DELETE PRODUCT SERVICE =====");
  console.log("Product ID received:", productId);
  console.log("Organization ID:", organizationId);
  console.log("User ID:", userId);
  console.log("==================================");

  try {
    await client.query("BEGIN");

    // Get product for audit
    const product = await findProductById(productId, organizationId);
    if (!product) {
      throw new ProductNotFoundError(productId);
    }

    // Soft delete
    const deleted = await softDeleteProduct(productId, organizationId);
    if (!deleted) {
      throw new ProductNotFoundError(productId);
    }

    // Audit log
    await createAuditLog({
      actorUserId: userId,
      organizationId,
      action: "PRODUCT_DELETED",
      entityType: "product",
      entityId: productId,
      oldValues: {
        name: product.name,
        description: product.description,
        active: product.active,
        variants: product.variants.map(v => ({
          sku: v.sku,
          priceCents: v.priceCents,
          stockQuantity: v.stockQuantity
        }))
      }
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}