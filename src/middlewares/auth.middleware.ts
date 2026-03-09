// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import pool from "../db/database";
import { hashSessionToken } from "../utils/crypto";
import { UserRole } from "../constants/permissions";
import { cacheGet, cacheSet, cacheKeys } from "../services/cache.service";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    organization_id: string | null;
  };
}

const SESSION_CACHE_TTL = 60 * 30; // 30 min (matches session lifetime)
const LAST_SEEN_INTERVAL_MS = 5 * 60 * 1000;

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const rawToken = req.cookies?.session_token;

    if (!rawToken) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const tokenHash = hashSessionToken(rawToken);
    const cacheKey = cacheKeys.session(tokenHash);

    const cached = await cacheGet<{
      user: AuthRequest["user"];
      session_id: string;
      last_seen_at: string;
    }>(cacheKey);

    if (cached) {
      console.log("[CACHE] session HIT — user:", cached.user?.email);
      req.user = cached.user;
      const lastSeen = new Date(cached.last_seen_at).getTime();
      if (Date.now() - lastSeen > LAST_SEEN_INTERVAL_MS) {
        await pool.query(
          "UPDATE sessions SET last_seen_at = NOW() WHERE id = $1",
          [cached.session_id]
        );
      }
      return next();
    }

    const result = await pool.query(
      `
      SELECT
        s.id AS session_id,
        s.user_id,
        s.last_seen_at,
        u.email,
        u.role,
        u.organization_id
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
      LIMIT 1
      `,
      [tokenHash]
    );

    const session = result.rows[0];

    if (!session) {
      console.log("[CACHE] session MISS — invalid/expired token");
      return res.status(401).json({ message: "Invalid session" });
    }

    console.log("[CACHE] session MISS — fetched from DB, caching for:", session.email);
    req.user = {
      id: session.user_id,
      email: session.email,
      role: session.role,
      organization_id: session.organization_id,
    };

    await cacheSet(
      cacheKey,
      {
        user: req.user,
        session_id: session.session_id,
        last_seen_at: session.last_seen_at,
      },
      SESSION_CACHE_TTL
    );

    const lastSeen = new Date(session.last_seen_at).getTime();
    if (Date.now() - lastSeen > LAST_SEEN_INTERVAL_MS) {
      await pool.query(
        "UPDATE sessions SET last_seen_at = NOW() WHERE id = $1",
        [session.session_id]
      );
    }

    return next();
  } catch (err) {
    console.error("authMiddleware error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};