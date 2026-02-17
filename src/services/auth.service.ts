//src/services/auth.service.ts
import bcrypt from "bcrypt";
import { createUser, findUserByEmail } from "../repository/users.repo";
import { createSession } from "../repository/sessions.repo";
import { generateSessionToken, hashSessionToken } from "../utils/crypto";

const SESSION_LIFETIME_MINUTES = 30;

export type AuthUser = {
  id: string;
  organizationId: string | null;
  email: string;
  role: string;
};

export type LoginResult = {
  user: AuthUser;
  sessionToken: string; // raw token (stored in cookie)
  expiresAt: Date;
};

export async function signupService(input: {
  email: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const email = input.email.trim().toLowerCase();

  // 1) Check if already exists
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  // 2) Hash password
  const passwordHash = await bcrypt.hash(input.password, 10);

  // 3) Create user (customer only)
  const user = await createUser({
    email,
    passwordHash,
    role: "customer",
    organizationId: null,
  });

  // 4) Create session
  const sessionToken = generateSessionToken();
  const sessionTokenHash = hashSessionToken(sessionToken);

  const expiresAt = new Date(
    Date.now() + SESSION_LIFETIME_MINUTES * 60 * 1000
  );

  await createSession({
    userId: user.id,
    sessionTokenHash,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    expiresAt,
  });

  return {
    user: {
      id: user.id,
      organizationId: user.organization_id,
      email: user.email,
      role: user.role,
    },
    sessionToken,
    expiresAt,
  };
};
export async function loginService(input: {
  email: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();

  // 1) Find user
  const user = await findUserByEmail(email);

  // Important: don't reveal if email exists or not
  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  // 2) Check active
  if (!user.is_active) {
    throw new Error("USER_DISABLED");
  }

  // 3) Compare password
  const isValidPassword = await bcrypt.compare(input.password, user.password_hash);

  if (!isValidPassword) {
    throw new Error("INVALID_CREDENTIALS");
  }

  // 4) Create session token (raw)
  const sessionToken = generateSessionToken();
  const sessionTokenHash = hashSessionToken(sessionToken);

  // 5) expiresAt
  const expiresAt = new Date(
    Date.now() + SESSION_LIFETIME_MINUTES * 60 * 1000
  );

  // 6) Store session in DB
  await createSession({
    userId: user.id,
    sessionTokenHash,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    expiresAt,
  });

  // 7) Return safe user + token
  return {
    user: {
      id: user.id,
      organizationId: user.organization_id,
      email: user.email,
      role: user.role,
    },
    sessionToken,
    expiresAt,
  };
}