// src/services/public.service.ts
import crypto from "crypto";
import {
  listPublicProducts,
  getPublicProductById,
} from "../repository/public-products.repo";
import {
  PublicProductFilters,
  PublicProductSummary,
  PublicProductDetail,
} from "../types/product.types";
import { ProductNotFoundError } from "../errors/product.errors";
import { ValidationError } from "../errors/AppError";
import { cacheGet, cacheSet, cacheKeys } from "./cache.service";

function filtersHash(filters: PublicProductFilters): string {
  return crypto.createHash("md5").update(JSON.stringify(filters)).digest("hex");
}

/**
 * Parse and validate public product filters from query params
 * 🔒 Sanitizes input to prevent injection/invalid values
 */
function parsePublicProductFilters(query: any): PublicProductFilters {
  // ✅ Default pagination values
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20)); // Cap at 100 for performance

  // ✅ Parse optional numeric filters
  const minPrice = query.min_price ? Math.max(0, parseInt(query.min_price)) : undefined;
  const maxPrice = query.max_price ? Math.max(0, parseInt(query.max_price)) : undefined;

  // ✅ Validate price range logic
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new Error("min_price cannot be greater than max_price");
  }

  return {
    page,
    limit,
    vendorSlug: query.vendor?.toString().trim() || undefined,
    minPrice,
    maxPrice,
    search: query.search?.toString().trim() || undefined,
  };
}

/**
 * Service: List public products with filters
 */
export async function listPublicProductsService(query: any): Promise<{
  products: PublicProductSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const filters = parsePublicProductFilters(query);
  const cacheKey = cacheKeys.publicProductList(filtersHash(filters));

  const cached = await cacheGet<{ products: PublicProductSummary[]; total: number }>(cacheKey);
  if (cached) {
    console.log("[CACHE] product list HIT — filters:", JSON.stringify(filters));
    const totalPages = Math.ceil(cached.total / filters.limit);
    return {
      products: cached.products,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: cached.total,
        totalPages,
      },
    };
  }

  console.log("[CACHE] product list MISS — fetching from DB, filters:", JSON.stringify(filters));
  const { products, total } = await listPublicProducts(filters);
  await cacheSet(cacheKey, { products, total }, 60 * 2); // 2 min TTL

  const totalPages = Math.ceil(total / filters.limit);
  return {
    products,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages,
    },
  };
}

/**
 * Service: Get single public product by ID
 * @throws {ProductNotFoundError} if product not found or not public
 */
export async function getPublicProductByIdService(
  productId: string
): Promise<PublicProductDetail> {

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(productId)) {
    throw new ValidationError(
      "validation.invalid_uuid",
      { field: "id" },
      {
        field: "params.id",
        code: "invalid_string",
      }
    );
  }

  const cacheKey = cacheKeys.publicProduct(productId);
  const cached = await cacheGet<PublicProductDetail>(cacheKey);
  if (cached) {
    console.log("[CACHE] product detail HIT — id:", productId);
    return cached;
  }

  console.log("[CACHE] product detail MISS — fetching from DB, id:", productId);

  const product = await getPublicProductById(productId);

  if (!product) {
    throw new ProductNotFoundError(productId);
  }

  await cacheSet(cacheKey, product, 60 * 10); // 10 min TTL
  return product;
}