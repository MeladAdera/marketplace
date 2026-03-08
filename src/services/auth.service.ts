// src/services/auth.service.ts
import bcrypt from "bcrypt";
import { createUser, findUserByEmail, findUserById } from "../repository/users.repo";
import { createSession } from "../repository/sessions.repo";
import { generateSessionToken, hashSessionToken } from "../utils/crypto";
import { User } from "../types/user.types";
import { UserRole } from "../constants/permissions";
import {
  InvalidCredentialsError,
  UserDisabledError,
  EmailAlreadyExistsError,
  InvalidRoleError
} from "../errors";

const SESSION_LIFETIME_MINUTES = 30;

export interface LoginResult {
  user: User;              
  sessionToken: string;
  sessionId: string;
  expiresAt: Date;
}

export interface SignupResult {
  user: User;              
  sessionToken: string;
  sessionId: string;
  expiresAt: Date;
}

export async function signupService(input: {
  email: string;
  password: string;
  role?: UserRole;
  organizationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<SignupResult> {
  const email = input.email.trim().toLowerCase();
const role = input.role || UserRole.CUSTOMER;
if (![UserRole.CUSTOMER, UserRole.VENDOR_ADMIN, UserRole.VENDOR_STAFF].includes(role)) {
  throw new InvalidRoleError(role);
}

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new EmailAlreadyExistsError();
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await createUser({
    email,
    passwordHash,
    role,
    organizationId: input.organizationId,
  });

  const sessionToken = generateSessionToken();
  const sessionTokenHash = hashSessionToken(sessionToken);

  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MINUTES * 60 * 1000);

  const session = await createSession({
    userId: user.id,
    sessionTokenHash,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    expiresAt,
  });

  return {
    user,                    
    sessionToken,
    sessionId: session.id,
    expiresAt,
  };
}

export async function loginService(input: {
  email: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();

  const user = await findUserByEmail(email);

  if (!user) {
    throw new InvalidCredentialsError();
  }

  const isValidPassword = await bcrypt.compare(input.password, user.password_hash);

  if (!isValidPassword) {
    throw new InvalidCredentialsError();
  }

  // التحقق من الحساب المفعل بعد التحقق من كلمة المرور
  if (!user.is_active) {
    throw new InvalidCredentialsError();  
  }

  const sessionToken = generateSessionToken();
  const sessionTokenHash = hashSessionToken(sessionToken);

  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MINUTES * 60 * 1000);

  const session = await createSession({
    userId: user.id,
    sessionTokenHash,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    expiresAt,
  });

  return {
    user,                    
    sessionToken,
    sessionId: session.id,
    expiresAt,
  };
}

export async function refreshSession(input: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<LoginResult> {
  const user = await findUserById(input.userId);

  if (!user || !user.is_active) {
    throw new InvalidCredentialsError();
  }

  const sessionToken = generateSessionToken();
  const sessionTokenHash = hashSessionToken(sessionToken);

  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MINUTES * 60 * 1000);

  const session = await createSession({
    userId: user.id,
    sessionTokenHash,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    expiresAt,
  });

  return {
    user,                   
    sessionToken,
    sessionId: session.id,
    expiresAt,
  };
}

export async function validateUserSession(userId: string): Promise<boolean> {
  const user = await findUserById(userId);
  return !!user && user.is_active;
}