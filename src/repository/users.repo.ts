//src/repository/users.repo.ts
import pool from "../db/database"

export type DbUserRow = {
  id: string;
  organization_id: string | null;
  email: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export async function findUserByEmail(email: string): Promise<DbUserRow | null> {
  const query = `
    SELECT
      id,
      organization_id,
      email,
      password_hash,
      role,
      is_active,
      created_at,
      updated_at
    FROM users
    WHERE email = $1
    LIMIT 1
  `;

  const result = await pool.query<DbUserRow>(query, [email]);
  return result.rows[0] ?? null;
};

export async function createUser(input: {
  email: string;
  passwordHash: string;
  role: string;
  organizationId?: string | null;
}) {
  const query = `
    INSERT INTO users (
      id,
      organization_id,
      email,
      password_hash,
      role,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      $4,
      true,
      NOW(),
      NOW()
    )
    RETURNING
      id,
      organization_id,
      email,
      role,
      is_active,
      created_at,
      updated_at
  `;

  const result = await pool.query(query, [
    input.organizationId ?? null,
    input.email,
    input.passwordHash,
    input.role,
  ]);

  return result.rows[0];
}