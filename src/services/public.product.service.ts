// src/services/public.service.ts
import { 
  listPublicProducts, 
  getPublicProductById 
} from "../repository/public-products.repo";
import { PublicProductFilters, PublicProductSummary, PublicProductDetail } from "../types/product.types";
import { ProductNotFoundError } from "../errors/product.errors"; 
import { ValidationError } from "../errors/AppError";

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
  // 1️⃣ Parse & validate input
  const filters = parsePublicProductFilters(query);

  // 2️⃣ Call repository
  const { products, total } = await listPublicProducts(filters);

  // 3️⃣ Shape pagination response
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
      'validation.invalid_uuid',
      { field: 'id' },
      {
        field: 'params.id',
        code: 'invalid_string'
      }
    );
  }

  const product = await getPublicProductById(productId);

  if (!product) {
    throw new ProductNotFoundError(productId);
  }

  return product;
}