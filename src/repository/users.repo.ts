// src/repository/users.repo.ts
import pool from "../db/database";
import { PoolClient } from "pg";  // ✅ أضف هذا الاستيراد
import { User, CreateUserInput, UserRole } from "../types/user.types";

// ✅ دالة مساعدة لاختيار المصدر (pool أو client)
function getDb(client?: PoolClient) {
  return client ?? pool;
}

// =============================================================================
// FIND USER BY EMAIL (محدث لدعم transactions)
// =============================================================================
export async function findUserByEmail(
  email: string,
  client?: PoolClient  // ✅ معامل اختياري
): Promise<User | null> {
  
  const db = getDb(client);  // ✅ نستخدم الدالة المساعدة
  
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

  const result = await db.query<User>(query, [email]);
  return result.rows[0] || null;
}

// =============================================================================
// FIND USER BY ID (محدث لدعم transactions)
// =============================================================================
export async function findUserById(
  id: string,
  client?: PoolClient
): Promise<User | null> {
  
  const db = getDb(client);
  
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

  const result = await db.query<User>(query, [id]);
  return result.rows[0] || null;
}

// =============================================================================
// CREATE USER (محدث لدعم transactions)
// =============================================================================
export async function createUser(
  input: {
    email: string;
    passwordHash: string;
    role: UserRole;
    organizationId?: string | null;
  },
  client?: PoolClient  // ✅ جديد
): Promise<User> {
  
  const db = getDb(client);
  
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
      $1, $2, $3, $4,
      true,
      NOW(),
      NOW()
    )
    RETURNING *
  `;

  const result = await db.query<User>(query, [
    input.organizationId ?? null,
    input.email,
    input.passwordHash,
    input.role,
  ]);

  return result.rows[0];
}

// =============================================================================
// UPDATE USER (محدث لدعم transactions)
// =============================================================================
export async function updateUser(
  id: string,
  input: Partial<{
    email: string;
    passwordHash: string;
    role: UserRole;
    isActive: boolean;
  }>,
  client?: PoolClient  // ✅ جديد
): Promise<User | null> {
  
  const db = getDb(client);
  
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
    return findUserById(id, client); // ✅ مرر client أيضاً
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const query = `
    UPDATE users
    SET ${updates.join(', ')}
    WHERE id = $${paramCounter}
    RETURNING *
  `;

  const result = await db.query<User>(query, values);
  return result.rows[0] || null;
}

// =============================================================================
// FIND USERS BY ORGANIZATION (محدث لدعم transactions)
// =============================================================================
export async function findUsersByOrganization(
  organizationId: string,
  options?: { role?: UserRole; limit?: number; offset?: number },
  client?: PoolClient  // ✅ جديد
): Promise<User[]> {
  
  const db = getDb(client);
  
  let query = `
    SELECT *
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

  const result = await db.query<User>(query, params);
  return result.rows;
}

// =============================================================================
// COUNT USERS BY ORGANIZATION (محدث لدعم transactions)
// =============================================================================
export async function countUsersByOrganization(
  organizationId: string,
  role?: UserRole,
  client?: PoolClient  // ✅ جديد
): Promise<number> {
  
  const db = getDb(client);
  
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

  const result = await db.query(query, params);
  return parseInt(result.rows[0].count);
}

// =============================================================================
// FIND USER BY EMAIL AND ORGANIZATION (محدث لدعم transactions)
// =============================================================================
export async function findUserByEmailAndOrganization(
  email: string,
  organizationId: string,
  client?: PoolClient  // ✅ جديد
): Promise<User | null> {
  
  const db = getDb(client);
  
  const query = `
    SELECT *
    FROM users
    WHERE email = $1 AND organization_id = $2
    LIMIT 1
  `;

  const result = await db.query<User>(query, [email, organizationId]);
  return result.rows[0] || null;
}

// =============================================================================
// 🆕 دوال جديدة خاصة بـ Platform Admin (تضاف هنا أو في platform-admin.repo.ts)
// =============================================================================

/**
 * Block/Unblock users by organization (Admin-only)
 */
export async function blockUsersByOrganization(
  organizationId: string,
  blockedBy: string,
  options?: {
    roles?: Array<'vendor_admin' | 'vendor_staff'>;
    reason?: string;
  },
  client?: PoolClient
): Promise<number> {
  
  const db = getDb(client);
  const roles = options?.roles || ['vendor_admin', 'vendor_staff'];
  
  const query = `
    UPDATE users
    SET 
      blocked = true,
      blocked_at = NOW(),
      blocked_by = $1,
      updated_at = NOW()
    WHERE organization_id = $2
      AND role = ANY($3)
      AND blocked = false
    RETURNING id
  `;

  const result = await db.query(query, [blockedBy, organizationId, roles]);
  return result.rows.length;
}

export async function unblockUsersByOrganization(
  organizationId: string,
  unblockedBy: string,
  options?: {
    roles?: Array<'vendor_admin' | 'vendor_staff'>;
    note?: string;
  },
  client?: PoolClient
): Promise<number> {
  
  const db = getDb(client);
  const roles = options?.roles || ['vendor_admin', 'vendor_staff'];
  
  const query = `
    UPDATE users
    SET 
      blocked = false,
      blocked_at = NULL,
      blocked_by = NULL,
      updated_at = NOW()
    WHERE organization_id = $1
      AND role = ANY($2)
      AND blocked = true
    RETURNING id
  `;

  const result = await db.query(query, [organizationId, roles]);
  return result.rows.length;
}