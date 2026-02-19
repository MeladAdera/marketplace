// src/controllers/auth.controller.ts
import { Request, Response } from "express";
import { loginService, signupService } from "./../services/auth.service";
import { clearSessionCookie, setSessionCookie } from "../utils/cookies";
import { hashSessionToken } from "../utils/crypto";
import { revokeSessionByTokenHash } from "../repository/sessions.repo";
import {  AuthResponse } from "../types/auth.types";
import { refreshSession } from "../services/auth.service";
import { findSessionByTokenHash } from "../repository/sessions.repo";
import { AuthRequest } from "../middlewares/auth.middleware"; 

/**
 * POST /auth/login
 * ✅ Validation: loginValidation
 * ✅ Rate limiting: loginLimiter
 */
export async function loginController(req: Request, res: Response) {
  try {
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

    return res.status(200).json(response);
  } catch (err: any) {
    if (err.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({ 
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password"
        }
      });
    }

    if (err.message === "USER_DISABLED") {
      return res.status(403).json({ 
        success: false,
        error: {
          code: "USER_DISABLED",
          message: "User account is disabled"
        }
      });
    }

    console.error("Login error:", err);
    return res.status(500).json({ 
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      }
    });
  }
}

/**
 * POST /auth/signup
 * ✅ Validation: signupValidation
 * ✅ Rate limiting: signupLimiter
 */
export async function signupController(req: Request, res: Response) {
  try {
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

    return res.status(201).json(response);
  } catch (err: any) {
    if (err.message === "EMAIL_ALREADY_EXISTS") {
      return res.status(409).json({ 
        success: false,
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "Email already exists"
        }
      });
    }

    if (err.message === "INVALID_ROLE") {
      return res.status(400).json({ 
        success: false,
        error: {
          code: "INVALID_ROLE",
          message: "Invalid user role"
        }
      });
    }

    console.error("Signup error:", err);
    return res.status(500).json({ 
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      }
    });
  }
}

/**
 * POST /auth/logout
 * ✅ Validation: logoutValidation 
 */
export async function logoutController(req: Request, res: Response) {
  try {
    const rawToken = req.cookies?.session_token;

    clearSessionCookie(res);

    if (!rawToken) {
      return res.status(200).json({ 
        success: true,
        message: "Logged out" 
      });
    }

    const tokenHash = hashSessionToken(rawToken);
    await revokeSessionByTokenHash(tokenHash);

    return res.status(200).json({ 
      success: true,
      message: "Logged out" 
    });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ 
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      }
    });
  }
}

/**
 * POST /auth/refresh
 * ✅ Validation: refreshValidation
 */
export async function refreshController(req: Request, res: Response) {
  try {
    const rawToken = req.cookies?.session_token; 

    const tokenHash = hashSessionToken(rawToken!);

    const session = await findSessionByTokenHash(tokenHash);

    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({
        success: false,
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Session not found",
        },
      });
    }

    if (session.revokedAt) {
      clearSessionCookie(res);
      return res.status(401).json({
        success: false,
        error: {
          code: "SESSION_REVOKED",
          message: "Session revoked",
        },
      });
    }

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      clearSessionCookie(res);
      return res.status(401).json({
        success: false,
        error: {
          code: "SESSION_EXPIRED",
          message: "Session expired",
        },
      });
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
      session: {
        id: result.sessionId,
        expiresAt: result.expiresAt,
      },
    });
  } catch (err) {
    console.error("Refresh error:", err);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    });
  }
}

/**
 * GET /auth/me
 * ✅ Validation: getMeValidation
 * ✅ Middleware: authMiddleware
 */
export async function getMeController(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated"
        }
      });
    }

  
    const { password_hash, ...userWithoutPassword } = req.user as any;
    
    return res.status(200).json({
      success: true,
      data: {
        user: userWithoutPassword
      }
    });
  } catch (err) {
    console.error("Get me error:", err);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      }
    });
  }
}