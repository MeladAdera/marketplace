// src/types/auth.types.ts
import { User, UserRole, UserWithOrganization } from "./user.types";  

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  role?: UserRole;
  organizationId?: string | null;
}

export interface AuthResponse {
  user: User;  
  session: SessionResponse;
}

export interface SessionResponse {
  id: string;
  expiresAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  sessionTokenHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface RefreshTokenResponse {
  session: SessionResponse;
}

export interface MeResponse {
  user: UserWithOrganization;  
}