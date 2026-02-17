// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import pool from "../db/database";
import { hashSessionToken } from "../utils/crypto";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    organization_id: string | null;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1) Read raw cookie token
    const rawToken = req.cookies?.session_token;

    if (!rawToken) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // 2) Hash it (because DB stores only hash)
    const tokenHash = hashSessionToken(rawToken);

    // 3) Find session + user
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
      return res.status(401).json({ message: "Invalid session" });
    }

    // 4) Attach user to request
    req.user = {
      id: session.user_id,
      email: session.email,
      role: session.role,
      organization_id: session.organization_id,
    };

    // 5) Update last_seen_at (only if old, to avoid DB spam)
    // Update only once every 5 minutes
    const lastSeen = new Date(session.last_seen_at).getTime();
    const now = Date.now();
    const FIVE_MINUTES = 5 * 60 * 1000;

    if (now - lastSeen > FIVE_MINUTES) {
      await pool.query(
        `
        UPDATE sessions
        SET last_seen_at = NOW()
        WHERE id = $1
        `,
        [session.session_id]
      );
    }

    return next();
  } catch (err) {
    console.error("authMiddleware error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};