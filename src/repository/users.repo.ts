// src/repository/users.repo.ts
import pool from "../db/database";
import { User, CreateUserInput, UserRole } from "../types/user.types";

export interface DbUserRow {
  id: string;
  organization_id: string | null;
  email: string;
  password_hash: string;
  role: UserRole;  // تغيير من string إلى UserRole
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// تحويل من صف قاعدة البيانات إلى كائن User
export function mapDbUserToUser(dbUser: DbUserRow): User {
  return {
    id: dbUser.id,
    organizationId: dbUser.organization_id,
    email: dbUser.email,
    passwordHash: dbUser.password_hash,
    role: dbUser.role,
    isActive: dbUser.is_active,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at,
  };
}

export async function findUserByEmail(email: string): Promise<User | null> {
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
  
  if (!result.rows[0]) {
    return null;
  }
  
  return mapDbUserToUser(result.rows[0]);
}

export async function findUserById(id: string): Promise<User | null> {
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
    WHERE id = $1
    LIMIT 1
  `;

  const result = await pool.query<DbUserRow>(query, [id]);
  
  if (!result.rows[0]) {
    return null;
  }
  
  return mapDbUserToUser(result.rows[0]);
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  role: UserRole;  // تغيير من string إلى UserRole
  organizationId?: string | null;
}): Promise<User> {
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
      password_hash,
      role,
      is_active,
      created_at,
      updated_at
  `;

  const result = await pool.query<DbUserRow>(query, [
    input.organizationId ?? null,
    input.email,
    input.passwordHash,
    input.role,
  ]);

  return mapDbUserToUser(result.rows[0]);
}

export async function updateUser(
  id: string,
  input: Partial<{
    email: string;
    passwordHash: string;
    role: UserRole;
    isActive: boolean;
  }>
): Promise<User | null> {
  // بناء query ديناميكي
  const updates: string[] = [];
  const values: any[] = [];
  let paramCounter = 1;

  if (input.email !== undefined) {
    updates.push(`email = $${paramCounter}`);
    values.push(input.email);
    paramCounter++;
  }

  if (input.passwordHash !== undefined) {
    updates.push(`password_hash = $${paramCounter}`);
    values.push(input.passwordHash);
    paramCounter++;
  }

  if (input.role !== undefined) {
    updates.push(`role = $${paramCounter}`);
    values.push(input.role);
    paramCounter++;
  }

  if (input.isActive !== undefined) {
    updates.push(`is_active = $${paramCounter}`);
    values.push(input.isActive);
    paramCounter++;
  }

  if (updates.length === 0) {
    return findUserById(id);
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const query = `
    UPDATE users
    SET ${updates.join(', ')}
    WHERE id = $${paramCounter}
    RETURNING
      id,
      organization_id,
      email,
      password_hash,
      role,
      is_active,
      created_at,
      updated_at
  `;

  const result = await pool.query<DbUserRow>(query, values);
  
  if (!result.rows[0]) {
    return null;
  }
  
  return mapDbUserToUser(result.rows[0]);
}
export async function findUsersByOrganization(
  organizationId: string,
  options?: { role?: string; limit?: number; offset?: number }
): Promise<User[]> {
  let query = `
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
    WHERE organization_id = $1
  `;
  
  const params: any[] = [organizationId];
  let paramCounter = 2;

  if (options?.role) {
    query += ` AND role = $${paramCounter}`;
    params.push(options.role);
    paramCounter++;
  }

  query += ` ORDER BY created_at DESC`;

  if (options?.limit) {
    query += ` LIMIT $${paramCounter}`;
    params.push(options.limit);
    paramCounter++;
  }

  if (options?.offset) {
    query += ` OFFSET $${paramCounter}`;
    params.push(options.offset);
  }

  const result = await pool.query<User>(query, params);
  return result.rows;
}

export async function countUsersByOrganization(
  organizationId: string,
  role?: string
): Promise<number> {
  let query = `
    SELECT COUNT(*) as count
    FROM users
    WHERE organization_id = $1
  `;
  
  const params: any[] = [organizationId];

  if (role) {
    query += ` AND role = $2`;
    params.push(role);
  }

  const result = await pool.query(query, params);
  return parseInt(result.rows[0].count);
}

export async function findUserByEmailAndOrganization(
  email: string,
  organizationId: string
): Promise<User | null> {
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
    WHERE email = $1 AND organization_id = $2
    LIMIT 1
  `;

  const result = await pool.query<User>(query, [email, organizationId]);
  return result.rows[0] || null;
}