import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { asyncHandler } from "../middlewares/errorHandler.middleware";
import {
  inviteStaffService,
  acceptInvitationService,
  revokeInvitationService,
  listInvitationsService,
} from "../services/vendor-user.service";
import { InvitationStatus } from "../types/invitation.types";

/**
 * POST /vendor/users/invite
 * Invite a staff member to the organization
 */
export const inviteStaffController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, role } = req.body;

  const result = await inviteStaffService(
    req.user!.organization_id!,
    req.user!.id,
    email,
    role
  );

  return res.status(201).json({
    success: true,
    message: req.t('invitation_sent', { ns: 'vendor' }),
     result,
  });
});

/**
 * POST /vendor/invitations/accept
 * Accept an invitation (user must be logged in first)
 */
export const acceptInvitationController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { token } = req.body;

  const result = await acceptInvitationService(token, req.user!.id);

  return res.status(200).json({
    success: true,
    message: req.t('invitation_accepted', { ns: 'vendor' }),
     result,
  });
});

/**
 * DELETE /vendor/invitations/:id
 * Revoke an invitation (Admin only)
 */
export const revokeInvitationController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params as { id: string }; // ✅ Force type to string

  await revokeInvitationService(
    req.user!.organization_id!,
    id,
    req.user!.id
  );

  return res.status(200).json({
    success: true,
    message: req.t('invitation_revoked', { ns: 'vendor' }),
  });
});

/**
 * GET /vendor/invitations
 * List all invitations for an organization
 */
export const listInvitationsController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page, limit, status } = req.query;

  // ✅ Convert query params to proper types
  const pageNum = page ? Number(page) : 1;
  const limitNum = limit ? Number(limit) : 20;
  
  // ✅ Validate status is a valid InvitationStatus
  const statusValidated = status && ['pending', 'accepted', 'revoked', 'expired'].includes(status as string)
    ? (status as InvitationStatus)
    : undefined;

  const result = await listInvitationsService(
    req.user!.organization_id!,
    pageNum,
    limitNum,
    statusValidated // ✅ Now properly typed
  );

  return res.status(200).json({
    success: true,
     result,
  });
});