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