// src/controllers/auth.controller.ts
import { Request, Response } from "express";
import { loginService, signupService } from "./../services/auth.service";
import { clearSessionCookie, setSessionCookie } from "../utils/cookies";
import { hashSessionToken } from "../utils/crypto";
import { revokeSessionByTokenHash } from "../repository/sessions.repo";
import { LoginCredentials, AuthResponse } from "../types/auth.types";

export async function loginController(req: Request, res: Response) {
  try {
    const { email, password } = req.body as LoginCredentials;

    if (!email || !password) {
      return res.status(400).json({ 
        message: "Email and password are required" 
      });
    }

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
      user: result.user, // ✅ الآن user كامل (isActive, createdAt موجودين)
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
};

export async function signupController(req: Request, res: Response) {
  try {
    const { email, password, role = 'customer', organizationId = null } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: {
          code: "MISSING_FIELDS",
          message: "Email and password are required"
        }
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        error: {
          code: "INVALID_PASSWORD",
          message: "Password must be at least 6 characters"
        }
      });
    }

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
      user: result.user, // ✅ الآن user كامل
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
};
export async function logoutController(req: Request, res: Response) {
  try {
    const rawToken = req.cookies?.session_token;

    // دائماً نمسح الكوكي حتى لو كان التوكن مفقود
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
};

