//src/types/product.types.ts
import { Organization } from './organization.types';

export interface Product {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  active: boolean;
  softDeletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductInput {
  organizationId: string;
  name: string;
  description?: string | null;
  active?: boolean;
}

export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  active?: boolean;
  softDeletedAt?: Date | null;
}

export interface ProductResponse {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Variant {
  id: string;
  productId: string;
  sku: string;
  name: string | null;
  priceCents: number;
  stockQuantity: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVariantInput {
  productId: string;
  organizationId?: string; // Add this as optional for SKU validation
  sku: string;
  name?: string | null;
  priceCents: number;
  stockQuantity?: number;
  active?: boolean;
}

export interface UpdateVariantInput {
  sku?: string;
  name?: string | null;
  priceCents?: number;
  stockQuantity?: number;
  active?: boolean;
}

export interface VariantResponse {
  id: string;
  productId: string;
  sku: string;
  name: string | null;
  priceCents: number;
  stockQuantity: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductWithVariants extends ProductResponse {
  variants: VariantResponse[];
  organization?: Pick<Organization, 'id' | 'name' | 'slug'>;
}

export interface ProductFilters {
  organizationId?: string;
  active?: boolean;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  page?: number;
  limit?: number;
}

export interface VariantFilters {
  productId?: string;
  active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}
/**
 * Filters for public product listing
 * 🔒 No organizationId filter - this is public!
 */
export interface PublicProductFilters {
  page: number;
  limit: number;
  vendorSlug?: string;      // Filter by vendor slug (not ID)
  minPrice?: number;        // Filter by min price (cents)
  maxPrice?: number;        // Filter by max price (cents)
  search?: string;          // Simple text search on name/description
}

/**
 * Lightweight product summary for list view
 * 🔒 Excludes: organizationId, softDeletedAt, internal flags
 */
export interface PublicProductSummary {
  id: string;
  name: string;
  description: string | null;
  vendor: {
    id: string;
    name: string;
    slug: string;
  };
  price_range: {
    min: number;  // in cents
    max: number;  // in cents
  };
  variant_count: number;
  has_stock: boolean;
  created_at: string; // ISO string for API
}

/**
 * Sanitized variant info for public view
 * 🔒 Excludes: productId, internal timestamps
 */
export interface PublicVariant {
  id: string;
  name: string | null;
  sku: string;
  price_cents: number;
  stock_quantity: number;
  active: boolean;
}

/**
 * Full product detail for public view with variants
 * 🔒 Excludes: organizationId, softDeletedAt, internal flags
 */
export interface PublicProductDetail {
  id: string;
  name: string;
  description: string | null;
  vendor: {
    id: string;
    name: string;
    slug: string;
  };
  variants: PublicVariant[];
  created_at: string; // ISO string for API
  updated_at: string; // ISO string for API
}