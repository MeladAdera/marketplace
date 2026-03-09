// src/types/organization.types.ts
import { UserResponse } from "./user.types";

export type OrganizationStatus = 'active' | 'suspended';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  status?: OrganizationStatus;
}

export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;      // ✅ أضفنا slug هنا
  status?: OrganizationStatus;
}

export type OrganizationResponse = Organization;

export interface OrganizationWithUsers extends OrganizationResponse {
  users?: UserResponse[];
}

export interface OrganizationFilters {
  status?: OrganizationStatus;
  search?: string;
  page?: number;
  limit?: number;
}

// ─────────────────────────────────────────────────────────────────────────
// ADMIN VIEW TYPES
// ─────────────────────────────────────────────────────────────────────────

export interface OrganizationAdminListItem {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  deleted_at: Date | null;
  created_at: Date;
  // Basic stats
  product_count: number;
  user_count: number;
}

export interface AdminVendorFilters {
  page?: number;
  limit?: number;
  status?: OrganizationStatus | 'deleted'; // include soft-deleted in admin view
  search?: string; // search by name or slug
  sortBy?: 'created_at' | 'name' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface SuspendVendorInput {
  reason: string;
  duration_hours?: number; // optional: auto-unblock after X hours
}

export interface ActivateVendorInput {
  note?: string;
}

export interface DeleteVendorInput {
  confirm: true; // safety: must be literal true
}