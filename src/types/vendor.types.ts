// src/types/vendor.types.ts
import { UserResponse } from "./user.types";
import { OrganizationResponse } from "./organization.types";

export interface RegisterVendorInput {
  companyName: string;
  companySlug: string;
  adminEmail: string;
  adminPassword: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface RegisterVendorResponse {
  user: UserResponse;
  organization: OrganizationResponse;
  session: {
    id: string;
    expiresAt: Date;
  };
  sessionToken: string; // للكوكي
}

export interface VendorProfileResponse {
  organization: OrganizationResponse;
  user: UserResponse;
  stats?: {
    totalProducts: number;
    totalStaff: number;
    totalOrders: number;
  };
}

export interface UpdateVendorInput {
  name?: string;
  slug?: string;
  status?: 'active' | 'suspended';
}