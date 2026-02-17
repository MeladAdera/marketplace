//src/controllers/auth.controller.ts
import { Request, Response } from "express";
import { loginService, signupService } from "./../services/auth.service";
import { clearSessionCookie, setSessionCookie } from "../utils/cookies";
import { hashSessionToken } from "../utils/crypto";
import { revokeSessionByTokenHash } from "../repository/sessions.repo";

export async function loginController(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip;

    const userAgent = req.headers["user-agent"] ?? null;

    const result = await loginService({
      email,
      password,
      ipAddress,
      userAgent,
    });

    // Set cookie
    setSessionCookie(res, result.sessionToken, result.expiresAt);

    return res.status(200).json({
      user: result.user,
    });
  } catch (err: any) {
    if (err.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (err.message === "USER_DISABLED") {
      return res.status(403).json({ message: "User account is disabled" });
    }

    console.error("Login error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export async function signupController(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip;

    const userAgent = req.headers["user-agent"] ?? null;

    const result = await signupService({
      email,
      password,
      ipAddress,
      userAgent,
    });

    setSessionCookie(res, result.sessionToken, result.expiresAt);

    return res.status(201).json({
      user: result.user,
    });
  } catch (err: any) {
    if (err.message === "EMAIL_ALREADY_EXISTS") {
      return res.status(409).json({ message: "Email already exists" });
    }

    console.error("Signup error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export async function logoutController(req: Request, res: Response) {
  try {
    const rawToken = req.cookies?.session_token;

    // Always clear cookie even if token missing
    clearSessionCookie(res);

    if (!rawToken) {
      return res.status(200).json({ message: "Logged out" });
    }

    const tokenHash = hashSessionToken(rawToken);

    await revokeSessionByTokenHash(tokenHash);

    return res.status(200).json({ message: "Logged out" });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}