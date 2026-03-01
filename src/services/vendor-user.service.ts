import pool from "../db/database";
import { PoolClient } from "pg";
import {
  createInvitation,
  getInvitationByToken,
  getInvitationById,
  acceptInvitation,
  revokeInvitation,
  listInvitations,
  countInvitations,
  findPendingInvitation,
} from "../repository/invitation.repo";
import { findUserByEmail } from "../repository/users.repo"; 
import { createAuditLog } from "../repository/audit.repo";
import {
  toResponse,
  InvitationStatus, 
} from "../types/invitation.types";
import {
  InvitationAlreadyExistsError,
  InvitationNotFoundError,
  InvitationExpiredError,
  InvitationAlreadyAcceptedError,
  UserAlreadyInOrganizationError,
} from "../errors/vendor.errors";

/**
 * Invite a staff member to the organization
 */
export async function inviteStaffService(
  organizationId: string,
  invitedByUserId: string,
  email: string,
  role: string
) {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Check if user already exists in THIS organization
    const existingUser = await findUserByEmail(email); 
    if (existingUser && existingUser.organization_id === organizationId) {
      throw new UserAlreadyInOrganizationError(email);
    }

    // 2. Check if there's already a pending invitation for this email
    const existingInvitation = await findPendingInvitation(client, organizationId, email); 
    if (existingInvitation) {
      throw new InvitationAlreadyExistsError(email);
    }

    // 3. Create the invitation
    const invitation = await createInvitation(client, {
      organizationId,
      email,
      role: role as 'vendor_admin' | 'vendor_staff',
      invitedByUserId,
    });

    // 4. Mock email sending (replace with actual email service)
    const inviteLink = `${process.env.FRONTEND_URL}/invite?token=${invitation.plain_token}`;
    console.log(`📧 Sending invitation to ${email}`);
    console.log(`🔗 Invite Link: ${inviteLink}`);
    // TODO: Implement actual email sending with sendGrid, SES, etc.

    // 5. Audit log
    await createAuditLog(
      {
        actorUserId: invitedByUserId,
        organizationId,
        action: "USER_INVITED",
        entityType: "invitation",
        entityId: invitation.id,
        newValues: { email, role },
      },
      client 
    );

    await client.query("COMMIT");

    // Return response without sensitive data
    const { plain_token, ...invitationWithoutToken } = invitation;
    return toResponse({ ...invitationWithoutToken, inviter_email: null });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Accept an invitation (user must be logged in first)
 */
export async function acceptInvitationService(token: string, userId: string) {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Get invitation by token
    const invitation = await getInvitationByToken(token);

    if (!invitation) {
      throw new InvitationNotFoundError();
    }

    // 2. Validate status (double check even though DB has constraints)
    if (invitation.status === 'accepted') {
      throw new InvitationAlreadyAcceptedError();
    }

    if (invitation.status === 'revoked') {
      throw new InvitationNotFoundError();
    }

    // 3. Check expiration
    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      throw new InvitationExpiredError();
    }

    // 4. Check if user already belongs to an organization
    const userCheck = await client.query(
      `SELECT organization_id FROM users WHERE id = $1`,
      [userId]
    );

    if (userCheck.rows[0]?.organization_id) {
      throw new UserAlreadyInOrganizationError(); 
    }

    // 5. Accept the invitation (update user + invitation)
    const success = await acceptInvitation(client, invitation.id, userId);

    if (!success) {
      throw new InvitationExpiredError(); // DB rejected the update
    }

    // 6. Audit log
    await createAuditLog(
      {
        actorUserId: userId,
        organizationId: invitation.organization_id,
        action: "INVITE_ACCEPTED",
        entityType: "user",
        entityId: userId,
        newValues: { role: invitation.role, organization_id: invitation.organization_id },
      },
      client 
    );

    await client.query("COMMIT");

    return {
      organizationId: invitation.organization_id,
      role: invitation.role,
      organizationName: invitation.org_name,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Revoke an invitation (Admin only)
 */
export async function revokeInvitationService(
  organizationId: string,
  invitationId: string,
  revokedByUserId: string
) {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Get invitation and verify it belongs to this organization
    const invitation = await getInvitationById(client, invitationId);

    if (!invitation) {
      throw new InvitationNotFoundError();
    }

    if (invitation.organization_id !== organizationId) {
      throw new InvitationNotFoundError();
    }

    if (invitation.status !== 'pending') {
      throw new InvitationAlreadyAcceptedError();
    }

    // 2. Revoke the invitation
    await revokeInvitation(client, invitationId);

    // 3. Audit log
    await createAuditLog(
      {
        actorUserId: revokedByUserId,
        organizationId,
        action: "INVITE_REVOKED",
        entityType: "invitation",
        entityId: invitationId,
        oldValues: { status: 'pending' },
        newValues: { status: 'revoked' },
      },
      client // ✅ تم إضافة client
    );

    await client.query("COMMIT");

    return { success: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * List all invitations for an organization
 */
export async function listInvitationsService(
  organizationId: string,
  page: number = 1,
  limit: number = 20,
  status?: InvitationStatus // ✅ تم التصحيح من string إلى InvitationStatus
) {
  const [invitations, total] = await Promise.all([
    listInvitations({ organizationId, status, page, limit }),
    countInvitations(organizationId, status),
  ]);

  return {
    invitations: invitations.map(toResponse),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}