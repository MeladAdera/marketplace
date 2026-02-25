import pool from "../db/database";
import { PoolClient } from "pg";
import { Invitation, CreateInvitationInput, InvitationFilters } from "../types/invitation.types";
import { generateSecureToken, hashToken } from "../utils/crypto";

/**
 * Create a new invitation (MUST be called inside a transaction)
 * 🔒 SECURITY: Token is hashed before storage
 */
export async function createInvitation(
  client: PoolClient,
  input: CreateInvitationInput
): Promise<Invitation> {
  const plainToken = generateSecureToken(); 
  const tokenHash = hashToken(plainToken);  
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); 

  const query = `
    INSERT INTO invitations (
      id,
      organization_id,
      email,
      role,
      token_hash,
      expires_at,
      invited_by_user_id,
      created_at
    )
    VALUES (
      gen_random_uuid(),
      $1,
      LOWER($2), -- Normalize email to lowercase
      $3,
      $4,
      $5,
      $6,
      NOW()
    )
    RETURNING *
  `;

  const result = await client.query(query, [
    input.organizationId,
    input.email,
    input.role,
    tokenHash,
    expiresAt,
    input.invitedByUserId,
  ]);

  const invitation = result.rows[0];
  // Attach plain token to return (won't be saved in DB)
  invitation.plain_token = plainToken; 
  
  return invitation;
}

/**
 * Get invitation by token (with organization info)
 * 🔒 SECURITY: Hash the token before querying
 */
export async function getInvitationByToken(plainToken: string): Promise<Invitation & { org_name?: string } | null> {
  const tokenHash = hashToken(plainToken); 
  
  const query = `
    SELECT 
      i.*,
      o.name as org_name
    FROM invitations i
    INNER JOIN organizations o ON i.organization_id = o.id
    WHERE i.token_hash = $1
  `;

  const result = await pool.query(query, [tokenHash]);
  return result.rows[0] || null;
}

/**
 * Get invitation by ID (MUST be called inside a transaction for updates)
 */
export async function getInvitationById(
  client: PoolClient,
  invitationId: string
): Promise<Invitation | null> {
  const query = `
    SELECT * FROM invitations
    WHERE id = $1
    FOR UPDATE
  `;

  const result = await client.query(query, [invitationId]);
  return result.rows[0] || null;
}

/**
 * Accept invitation - update status and link user to organization
 * 🔒 SECURITY: Enforce status='pending' AND expires_at > NOW() at DB level
 */
export async function acceptInvitation(
  client: PoolClient,
  invitationId: string,
  userId: string
): Promise<boolean> {
  // Update invitation status with validation conditions
  const updateInvitation = `
    UPDATE invitations 
    SET status = 'accepted', accepted_at = NOW() 
    WHERE id = $1
      AND status = 'pending'
      AND expires_at > NOW()
  `;

  const result = await client.query(updateInvitation, [invitationId]);

  // 🔒 Check if the update actually happened
  if (result.rowCount === 0) {
    return false; // Invitation was expired, revoked, or already accepted
  }

  // Update user's organization and role
  await client.query(
    `UPDATE users 
     SET organization_id = (SELECT organization_id FROM invitations WHERE id = $1),
         role = (SELECT role FROM invitations WHERE id = $1),
         updated_at = NOW()
     WHERE id = $2`,
    [invitationId, userId]
  );

  return true;
}

/**
 * Revoke invitation
 */
export async function revokeInvitation(
  client: PoolClient,
  invitationId: string
): Promise<void> {
  await client.query(
    `UPDATE invitations 
     SET status = 'revoked', revoked_at = NOW() 
     WHERE id = $1`,
    [invitationId]
  );
}

/**
 * List invitations for an organization
 */
export async function listInvitations(
  filters: InvitationFilters
): Promise<(Invitation & { inviter_email?: string | null })[]> {
  let query = `
    SELECT 
      i.*,
      u.email as inviter_email
    FROM invitations i
    LEFT JOIN users u ON i.invited_by_user_id = u.id
    WHERE i.organization_id = $1
  `;

  const params: any[] = [filters.organizationId];
  let paramIndex = 2;

  if (filters.status) {
    query += ` AND i.status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  query += ` ORDER BY i.created_at DESC`;

  if (filters.limit && filters.page) {
    const offset = (filters.page - 1) * filters.limit;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(filters.limit, offset);
  }

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Count invitations for pagination
 */
export async function countInvitations(
  organizationId: string,
  status?: string
): Promise<number> {
  let query = `
    SELECT COUNT(*) FROM invitations
    WHERE organization_id = $1
  `;

  const params: any[] = [organizationId];

  if (status) {
    query += ` AND status = $2`;
    params.push(status);
  }

  const result = await pool.query(query, params);
  return parseInt(result.rows[0].count);
}

/**
 * Check if there's a pending invitation for an email in an organization
 */
export async function findPendingInvitation(
  client: PoolClient, // ✅ Add client parameter
  organizationId: string,
  email: string
): Promise<Invitation | null> {
  const query = `
    SELECT * FROM invitations
    WHERE organization_id = $1
      AND LOWER(email) = LOWER($2)
      AND status = 'pending'
      AND expires_at > NOW()
  `;

 const result = await client.query(query, [organizationId, email]); // ✅ Use client
  return result.rows[0] || null;
}
