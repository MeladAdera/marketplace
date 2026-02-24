import { z } from 'zod';

/**
 * Invite Staff Validation
 */
export const inviteStaffValidation = z.object({
  body: z.object({
    email: z
      .string()
      .email('Invalid email address')
      .transform((val) => val.toLowerCase().trim()),
    role: z
      .enum(['vendor_admin', 'vendor_staff'], {
        errorMap: () => ({ message: 'Role must be vendor_admin or vendor_staff' }),
      }),
  }),
});

/**
 * Accept Invitation Validation
 */
export const acceptInvitationValidation = z.object({
  body: z.object({
    token: z
      .string()
      .min(32, 'Invalid invitation token')
      .max(255, 'Invalid invitation token'),
  }),
});

/**
 * Revoke Invitation Validation
 */
export const revokeInvitationValidation = z.object({
  params: z.object({
    id: z
      .string()
      .uuid('Invalid invitation ID'),
  }),
});

/**
 * List Invitations Validation
 */
export const listInvitationsValidation = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    status: z.enum(['pending', 'accepted', 'revoked', 'expired']).optional(),
  }),
});