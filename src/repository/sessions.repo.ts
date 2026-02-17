//src/repository/sessions.repo.ts
import pool from "../db/database"
export type DbSessionRow = {
  id: string;
  user_id: string;
  session_token_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  last_seen_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
};

type CreateSessionInput = {
  userId: string;
  sessionTokenHash: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  expiresAt: Date;
};

export async function createSession(
  input: CreateSessionInput
): Promise<DbSessionRow> {
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

  return result.rows[0];
};

export async function revokeSessionByTokenHash(tokenHash: string) {
  const query = `
    UPDATE sessions
    SET revoked_at = NOW()
    WHERE session_token_hash = $1
      AND revoked_at IS NULL
    RETURNING id
  `;

  const result = await pool.query(query, [tokenHash]);
  return result.rows[0] ?? null;
}