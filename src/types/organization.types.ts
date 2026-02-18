import { UserResponse } from "./user.types";

export type OrganizationStatus = 'active' | 'suspended';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  status?: OrganizationStatus;
}

export interface UpdateOrganizationInput {
  name?: string;
  status?: OrganizationStatus;
}

export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationWithUsers extends OrganizationResponse {
  users?: UserResponse[];
}

export interface OrganizationFilters {
  status?: OrganizationStatus;
  search?: string;
  page?: number;
  limit?: number;
}