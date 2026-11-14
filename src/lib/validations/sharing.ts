import { z } from "zod";

/**
 * Validation schemas for list sharing and invitations.
 */

export const inviteCollaboratorSchema = z.object({
  listId: z.string().uuid("Invalid list ID format."),
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Please provide a valid email address.")
    .toLowerCase(),
  role: z.enum(["EDITOR", "VIEWER"], {
    message: "Role must be either EDITOR or VIEWER.",
  }),
});

export type InviteCollaboratorInput = z.infer<typeof inviteCollaboratorSchema>;

export const updateMemberRoleSchema = z.object({
  memberId: z.string().uuid("Invalid member ID format."),
  role: z.enum(["EDITOR", "VIEWER"], {
    message: "Role must be either EDITOR or VIEWER.",
  }),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const removeMemberSchema = z.object({
  memberId: z.string().uuid("Invalid member ID format."),
});

export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

export const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid("Invalid invitation ID format."),
});

export type RevokeInvitationInput = z.infer<typeof revokeInvitationSchema>;

export const leaveListSchema = z.object({
  listId: z.string().uuid("Invalid list ID format."),
});

export type LeaveListInput = z.infer<typeof leaveListSchema>;

export const inspectInvitationSchema = z.object({
  token: z.string().min(1, "Invitation token is required."),
});

export type InspectInvitationInput = z.infer<typeof inspectInvitationSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Invitation token is required."),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

