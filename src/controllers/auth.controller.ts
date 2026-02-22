// src/controllers/auth.controller.ts 

import { Request, Response } from "express";
import { loginService, signupService, refreshSession } from "./../services/auth.service";
import { clearSessionCookie, setSessionCookie } from "../utils/cookies";
import { hashSessionToken } from "../utils/crypto";
import { revokeSessionByTokenHash, findSessionByTokenHash } from "../repository/sessions.repo";
import { AuthResponse } from "../types/auth.types";
import { AuthRequest } from "../middlewares/auth.middleware";
import { asyncHandler } from "../middlewares/errorHandler.middleware";
import {
  SessionNotFoundError,
  SessionRevokedError,
  SessionExpiredError,
  UnauthorizedError
} from "../errors";

/**
 * POST /auth/login
 */
export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const ipAddress =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.ip ||
    "unknown";

  const userAgent = req.headers["user-agent"] ?? null;

  const result = await loginService({
    email,
    password,
    ipAddress,
    userAgent,
  });

  setSessionCookie(res, result.sessionToken, result.expiresAt);

  const response: AuthResponse = {
    user: result.user,
    session: {
      id: result.sessionId,
      expiresAt: result.expiresAt,
    },
  };

  return res.status(200).json({
    success: true,
    message: req.t('login_success', { ns: 'auth' }), 
  });
});

/**
 * POST /auth/signup
 */
export const signupController = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, role, organizationId } = req.body;

  const ipAddress =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.ip ||
    "unknown";

  const userAgent = req.headers["user-agent"] ?? null;

  const result = await signupService({
    email,
    password,
    role,
    organizationId,
    ipAddress,
    userAgent,
  });

  setSessionCookie(res, result.sessionToken, result.expiresAt);

  const response: AuthResponse = {
    user: result.user,
    session: {
      id: result.sessionId,
      expiresAt: result.expiresAt,
    },
  };

  return res.status(201).json({
    success: true,
    message: req.t('signup_success', { ns: 'auth' }), 
    data: response
  });
});

/**
 * POST /auth/logout
 */
export const logoutController = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.session_token;

  clearSessionCookie(res);

  if (rawToken) {
    const tokenHash = hashSessionToken(rawToken);
    await revokeSessionByTokenHash(tokenHash);
  }

  return res.status(200).json({
    success: true,
    message: req.t('logout_success', { ns: 'auth' }) 
  });
});

/**
 * POST /auth/refresh
 */
export const refreshController = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.session_token;

  if (!rawToken) {
    throw new UnauthorizedError('No session token provided');
  }

  const tokenHash = hashSessionToken(rawToken);
  const session = await findSessionByTokenHash(tokenHash);

  if (!session) {
    clearSessionCookie(res);
    throw new SessionNotFoundError();
  }

  if (session.revokedAt) {
    clearSessionCookie(res);
    throw new SessionRevokedError();
  }

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    clearSessionCookie(res);
    throw new SessionExpiredError();
  }

  const ipAddress =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.ip ||
    "unknown";

  const userAgent = req.headers["user-agent"] ?? null;

  const result = await refreshSession({
    userId: session.userId,
    ipAddress,
    userAgent,
  });

  await revokeSessionByTokenHash(tokenHash);
  setSessionCookie(res, result.sessionToken, result.expiresAt);

  return res.status(200).json({
    success: true,
    message: req.t('refresh_success', { ns: 'auth' }), 
    session: {
      id: result.sessionId,
      expiresAt: result.expiresAt,
    },
  });
});

/**
 * GET /auth/me
 */
export const getMeController = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  const { password_hash, ...userWithoutPassword } = req.user as any;

  return res.status(200).json({
    success: true,
    message: req.t('profile_success', { ns: 'auth' }), 
    data: {
      user: userWithoutPassword
    }
  });
});