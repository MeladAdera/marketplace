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