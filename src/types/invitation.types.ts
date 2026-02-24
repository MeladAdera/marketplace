export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export type InvitationRole = 'vendor_admin' | 'vendor_staff';

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: InvitationRole;
  token_hash: string;  // ✅ Changed from token to token_hash
  expires_at: Date;
  status: InvitationStatus;
  invited_by_user_id: string | null;
  created_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
  plain_token?: string;  // ✅ Added (temporary, only after creation)
  org_name?: string;  // ✅ Added (for joins)
}

export interface CreateInvitationInput {
  organizationId: string;
  email: string;
  role: InvitationRole;
  invitedByUserId: string;
}

export interface AcceptInvitationInput {
  token: string;
  userId: string;
}

export interface InvitationResponse {
  id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
  invitedBy: {
    id: string;
    email: string;
  } | null;
}

export function toResponse(invitation: Invitation & { inviter_email?: string | null }): InvitationResponse {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expires_at,
    createdAt: invitation.created_at,
    acceptedAt: invitation.accepted_at,
    invitedBy: invitation.invited_by_user_id 
      ? { id: invitation.invited_by_user_id, email: invitation.inviter_email ?? '' } 
      : null,
  };
}

export interface InvitationFilters {
  organizationId: string;
  status?: InvitationStatus;
  page?: number;
  limit?: number;
}