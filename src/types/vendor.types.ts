// src/types/vendor.types.ts
import { UserResponse } from "./user.types";
import { OrganizationResponse } from "./organization.types";
import { ProductResponse } from "./product.types";

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
  sessionToken: string;
}

export interface VendorProfileResponse {
  organization: OrganizationResponse;
  admin: UserResponse;
  staff: UserResponse[];
  stats: {
    totalProducts: number;
    totalStaff: number;
    totalOrders: number;
    totalRevenue: number;
    pendingOrders: number;
  };
}

export interface InviteStaffInput {
  email: string;
  role: 'vendor_staff' | 'vendor_admin';
  name?: string;
}

export interface InviteStaffResponse {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted';
  invitedAt: Date;
}

export interface UpdateVendorInput {
  name?: string;
  slug?: string;
  status?: 'active' | 'suspended';
}

export interface VendorProductFilters {
  page?: number;
  limit?: number;
  active?: boolean;
  search?: string;
}