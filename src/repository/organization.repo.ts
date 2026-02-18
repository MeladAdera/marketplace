// src/repository/organization.repo.ts
import pool from "../db/database";
import { Organization, CreateOrganizationInput, UpdateOrganizationInput } from "../types/organization.types";

export async function createOrganization(input: CreateOrganizationInput): Promise<Organization> {
  const query = `
    INSERT INTO organizations (
      id,
      name,
      slug,
      status,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      $1,
      $2,
      $3,
      NOW(),
      NOW()
    )
    RETURNING
      id,
      name,
      slug,
      status,
      created_at,
      updated_at
  `;

  const result = await pool.query<Organization>(query, [
    input.name,
    input.slug,
    input.status || 'active',
  ]);

  return result.rows[0];  // ✅ مباشرة
}

export async function findOrganizationBySlug(slug: string): Promise<Organization | null> {
  const query = `
    SELECT
      id,
      name,
      slug,
      status,
      created_at,
      updated_at
    FROM organizations
    WHERE slug = $1
    LIMIT 1
  `;

  const result = await pool.query<Organization>(query, [slug]);
  return result.rows[0] || null;  // ✅ مباشرة
}

export async function findOrganizationById(id: string): Promise<Organization | null> {
  const query = `
    SELECT
      id,
      name,
      slug,
      status,
      created_at,
      updated_at
    FROM organizations
    WHERE id = $1
    LIMIT 1
  `;

  const result = await pool.query<Organization>(query, [id]);
  return result.rows[0] || null;  // ✅ مباشرة
}

export async function updateOrganization(
  id: string,
  input: UpdateOrganizationInput
): Promise<Organization | null> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramCounter = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramCounter}`);
    values.push(input.name);
    paramCounter++;
  }

  if (input.slug !== undefined) {
    updates.push(`slug = $${paramCounter}`);
    values.push(input.slug);
    paramCounter++;
  }

  if (input.status !== undefined) {
    updates.push(`status = $${paramCounter}`);
    values.push(input.status);
    paramCounter++;
  }

  if (updates.length === 0) {
    return findOrganizationById(id);
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const query = `
    UPDATE organizations
    SET ${updates.join(', ')}
    WHERE id = $${paramCounter}
    RETURNING
      id,
      name,
      slug,
      status,
      created_at,
      updated_at
  `;

  const result = await pool.query<Organization>(query, values);
  return result.rows[0] || null;  // ✅ مباشرة
}