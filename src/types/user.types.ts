// src/types/user.types.ts
import { UserRole } from '../constants/permissions';
import { Organization } from './organization.types';



export interface User {
  id: string;                    
  organization_id: string | null; 
  email: string;                  
  password_hash: string;         
  role: UserRole;               
                
  is_active: boolean;             
  created_at: Date;              
  updated_at: Date;              
}

export interface UserResponse {
  id: string;
  organizationId: string | null;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
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

export function toResponse(user: User): UserResponse {
  return {
    id: user.id,
    organizationId: user.organization_id,
    email: user.email,
    role: user.role,
    isActive: user.is_active,
    createdAt: user.created_at,
  };
}

export function toDbCreate(input: CreateUserInput, passwordHash: string) {
  return {
    organization_id: input.organizationId,
    email: input.email,
    password_hash: passwordHash,
    role: input.role,
    is_active: input.isActive ?? true,
  };
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

export { UserRole };
