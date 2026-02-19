// src/services/auth.service.ts
import bcrypt from "bcrypt";
import { createUser, findUserByEmail, findUserById } from "../repository/users.repo";
import { createSession } from "../repository/sessions.repo";
import { generateSessionToken, hashSessionToken } from "../utils/crypto";
import { toUserResponse } from "../utils/mappers/user.mapper";
import { UserResponse, UserRole } from "../types/user.types";

const SESSION_LIFETIME_MINUTES = 30;

export interface LoginResult {
  user: UserResponse;
  sessionToken: string;
  sessionId: string;
  expiresAt: Date;
}

export interface SignupResult {
  user: UserResponse;
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
  const role = input.role || "customer";

  if (!["customer", "vendor_admin", "vendor_staff"].includes(role)) {
    throw new Error("INVALID_ROLE");
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("EMAIL_ALREADY_EXISTS");
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
    user: toUserResponse(user),
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
    throw new Error("INVALID_CREDENTIALS");
  }

  if (!user.isActive) {
    throw new Error("USER_DISABLED");
  }

  const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);

  if (!isValidPassword) {
    throw new Error("INVALID_CREDENTIALS");
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
    user: toUserResponse(user),
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

  if (!user || !user.isActive) {
    throw new Error("USER_NOT_FOUND_OR_DISABLED");
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
    user: toUserResponse(user),
    sessionToken,
    sessionId: session.id,
    expiresAt,
  };
}

export async function validateUserSession(userId: string): Promise<boolean> {
  const user = await findUserById(userId);
  return !!user && user.isActive;
}
