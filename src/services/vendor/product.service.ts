import pool from "../../db/database";

import {
  createProduct,
  createVariants,
  updateProduct,
  softDeleteProduct,
  findProductById,
  findProductsByOrganization,
  countProductsByOrganization,
  findVariantsByProductIds,
  findVariantsByProductId
} from "../../repository/products.repo";

import { createAuditLog } from "../../repository/audit.repo";

import {
  ProductNotFoundError,
  DuplicateSkuError
} from "../../errors/product.errors";

/**
 * CREATE PRODUCT + VARIANTS
 */
export async function createProductWithVariantsService(
  organizationId: string,
  input: any,
  userId: string
) {

  const client = await pool.connect();

  try {

    await client.query("BEGIN");

    const skus = input.variants.map((v: any) => v.sku);

    if (new Set(skus).size !== skus.length) {
      throw new DuplicateSkuError("Duplicate SKUs in request");
    }

    const product = await createProduct(
      {
        organizationId,
        name: input.name,
        description: input.description,
        active: input.active
      },
      client
    );

    const variants = await createVariants(
      input.variants.map((v: any) => ({
        productId: product.id,
        sku: v.sku,
        priceCents: Math.round(v.price * 100),
        stockQuantity: v.stock,
        active: true
      })),
      client
    );

    await createAuditLog(
      {
        actorUserId: userId,
        organizationId,
        action: "PRODUCT_CREATED",
        entityType: "product",
        entityId: product.id
      },
      client
    );

    await client.query("COMMIT");

    return {
      ...product,
      variants
    };

  } catch (error: any) {

    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw new DuplicateSkuError("SKU already exists");
    }

    throw error;

  } finally {
    client.release();
  }
}

/**
 * GET PRODUCTS
 */
export async function getVendorProductsService(
  organizationId: string,
  filters: any
) {

  const { page = 1, limit = 10, active, search } = filters;

  const offset = (page - 1) * limit;

  const products = await findProductsByOrganization(
    organizationId,
    { active, search, limit, offset }
  );

  const productIds = products.map(p => p.id);

  let variants: any[] = [];

  if (productIds.length) {
    variants = await findVariantsByProductIds(productIds);
  }

  const variantsMap: Record<string, any[]> = {};

  for (const variant of variants) {

    if (!variantsMap[variant.product_id]) {
      variantsMap[variant.product_id] = [];
    }

    variantsMap[variant.product_id].push(variant);
  }

  const result = products.map(p => ({
    ...p,
    variants: variantsMap[p.id] || []
  }));

  const total = await countProductsByOrganization(
    organizationId,
    { active, search }
  );

  return {
    products: result,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * GET PRODUCT BY ID
 */
export async function getVendorProductByIdService(
  organizationId: string,
  productId: string
) {

  const product = await findProductById(productId, organizationId);

  if (!product) {
    throw new ProductNotFoundError(productId);
  }

  return product;
}

/**
 * UPDATE PRODUCT
 */
export async function updateProductService(
  organizationId: string,
  productId: string,
  input: any,
  userId: string
) {

  const client = await pool.connect();

  try {

    await client.query("BEGIN");

    const updated = await updateProduct(
      productId,
      organizationId,
      input,
      client
    );

    if (!updated) {
      throw new ProductNotFoundError(productId);
    }

    await createAuditLog(
      {
        actorUserId: userId,
        organizationId,
        action: "PRODUCT_UPDATED",
        entityType: "product",
        entityId: productId
      },
      client
    );

    await client.query("COMMIT");

    const variants = await findVariantsByProductId(productId);

    return {
      ...updated,
      variants
    };

  } catch (error) {

    await client.query("ROLLBACK");
    throw error;

  } finally {
    client.release();
  }
}

/**
 * DELETE PRODUCT
 */
export async function deleteProductService(
  organizationId: string,
  productId: string,
  userId: string
) {

  const client = await pool.connect();

  try {

    await client.query("BEGIN");

    const product = await findProductById(productId, organizationId, client);

    if (!product) {
      throw new ProductNotFoundError(productId);
    }

    const deleted = await softDeleteProduct(
      productId,
      organizationId,
      client
    );

    if (!deleted) {
      throw new ProductNotFoundError(productId);
    }

    await createAuditLog(
      {
        actorUserId: userId,
        organizationId,
        action: "PRODUCT_DELETED",
        entityType: "product",
        entityId: productId
      },
      client
    );

    await client.query("COMMIT");

  } catch (error) {

    await client.query("ROLLBACK");
    throw error;

  } finally {
    client.release();
  }
}