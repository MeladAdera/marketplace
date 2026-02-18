import { Organization } from './organization.types';

export type UserRole = 
  | 'customer' 
  | 'vendor_admin' 
  | 'vendor_staff' 
  | 'support' 
  | 'platform_admin';

export interface User {
  id: string;
  organizationId: string | null;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
  organizationId?: string | null;
  isActive?: boolean;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UserResponse {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface UserWithOrganization extends UserResponse {
  organization?: Pick<Organization, 'id' | 'name' | 'slug'> | null;
}

export interface UserFilters {
  role?: UserRole;
  organizationId?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}