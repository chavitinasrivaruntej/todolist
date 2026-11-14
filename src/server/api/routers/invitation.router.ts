import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  inspectInvitationSchema,
  acceptInvitationSchema,
} from "@/lib/validations/sharing";
import { invitationService } from "@/server/services/invitation.service";

/**
 * Invitation Router.
 * Handles inspecting an invitation (public) and accepting an invitation (protected).
 */
export const invitationRouter = createTRPCRouter({
  /**
   * Publicly inspects an invitation token.
   * Returns list name, inviter email, role, and target email so the user can review before accepting.
   */
  inspect: publicProcedure
    .input(inspectInvitationSchema)
    .query(async ({ input }) => {
      return invitationService.inspectInvitation(input.token);
    }),

  /**
   * Accepts an invitation.
   * Requires an authenticated session whose email matches the invited email.
   */
  accept: protectedProcedure
    .input(acceptInvitationSchema)
    .mutation(async ({ input, ctx }) => {
      const userEmail = ctx.user.email;
      if (!userEmail) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User email not found in authenticated session.",
        });
      }

      return invitationService.acceptInvitation(
        input.token,
        ctx.user.id,
        userEmail
      );
    }),
});
