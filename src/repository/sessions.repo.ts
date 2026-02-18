// src/repository/sessions.repo.ts
import pool from "../db/database";
import { Session } from "../types/auth.types";

export interface DbSessionRow {
  id: string;
  user_id: string;
  session_token_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  last_seen_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

// تحويل من صف قاعدة البيانات إلى كائن Session
export function mapDbSessionToSession(dbSession: DbSessionRow): Session {
  return {
    id: dbSession.id,
    userId: dbSession.user_id,
    sessionTokenHash: dbSession.session_token_hash,
    ipAddress: dbSession.ip_address,
    userAgent: dbSession.user_agent,
    lastSeenAt: dbSession.last_seen_at,
    expiresAt: dbSession.expires_at,
    revokedAt: dbSession.revoked_at,
    createdAt: dbSession.created_at,
  };
}

export interface CreateSessionInput {
  userId: string;
  sessionTokenHash: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  expiresAt: Date;
}

export async function createSession(
  input: CreateSessionInput
): Promise<Session> {
  const { userId, sessionTokenHash, ipAddress, userAgent, expiresAt } = input;

  const query = `
    INSERT INTO sessions (
      user_id,
      session_token_hash,
      ip_address,
      user_agent,
      last_seen_at,
      expires_at,
      created_at
    )
    VALUES ($1, $2, $3, $4, NOW(), $5, NOW())
    RETURNING
      id,
      user_id,
      session_token_hash,
      ip_address,
      user_agent,
      last_seen_at,
      expires_at,
      revoked_at,
      created_at
  `;

  const result = await pool.query<DbSessionRow>(query, [
    userId,
    sessionTokenHash,
    ipAddress ?? null,
    userAgent ?? null,
    expiresAt,
  ]);

  return mapDbSessionToSession(result.rows[0]);
}

export async function findSessionByTokenHash(
  tokenHash: string
): Promise<Session | null> {
  const query = `
    SELECT
      id,
      user_id,
      session_token_hash,
      ip_address,
      user_agent,
      last_seen_at,
      expires_at,
      revoked_at,
      created_at
    FROM sessions
    WHERE session_token_hash = $1
    LIMIT 1
  `;

  const result = await pool.query<DbSessionRow>(query, [tokenHash]);
  
  if (!result.rows[0]) {
    return null;
  }
  
  return mapDbSessionToSession(result.rows[0]);
}

export async function revokeSessionByTokenHash(
  tokenHash: string
): Promise<Session | null> {
  const query = `
    UPDATE sessions
    SET revoked_at = NOW()
    WHERE session_token_hash = $1
      AND revoked_at IS NULL
    RETURNING
      id,
      user_id,
      session_token_hash,
      ip_address,
      user_agent,
      last_seen_at,
      expires_at,
      revoked_at,
      created_at
  `;

  const result = await pool.query<DbSessionRow>(query, [tokenHash]);
  
  if (!result.rows[0]) {
    return null;
  }
  
  return mapDbSessionToSession(result.rows[0]);
}

export async function revokeAllUserSessions(
  userId: string
): Promise<void> {
  const query = `
    UPDATE sessions
    SET revoked_at = NOW()
    WHERE user_id = $1
      AND revoked_at IS NULL
  `;

  await pool.query(query, [userId]);
}

export async function updateLastSeen(
  sessionId: string
): Promise<void> {
  const query = `
    UPDATE sessions
    SET last_seen_at = NOW()
    WHERE id = $1
  `;

  await pool.query(query, [sessionId]);
}

export async function deleteExpiredSessions(): Promise<number> {
  const query = `
    DELETE FROM sessions
    WHERE expires_at < NOW()
       OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days')
    RETURNING id
  `;

  const result = await pool.query(query);
  return result.rowCount || 0;
}