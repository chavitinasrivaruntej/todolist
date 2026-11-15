import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  inviteCollaboratorSchema,
  updateMemberRoleSchema,
  removeMemberSchema,
  revokeInvitationSchema,
  leaveListSchema,
} from "@/lib/validations/sharing";
import { invitationService } from "@/server/services/invitation.service";
import { todoListService } from "@/server/services/todo-list.service";
import { listPermissionService } from "@/server/services/list-permission.service";
import { activityService } from "@/server/services/activity.service";
import { notificationService } from "@/server/services/notification.service";
import { listMemberRepository } from "@/server/repositories/list-member.repository";
import { invitationRepository } from "@/server/repositories/invitation.repository";
import { todoListRepository } from "@/server/repositories/todo-list.repository";
import { NotFoundError } from "@/server/errors";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Sharing Router.
 * Handles collaborator invitations, member management, role updates, and leaving lists.
 */
export const sharingRouter = createTRPCRouter({
  /**
   * Retrieves all members and pending invitations for a specific list.
   * Only list members or the owner can query members.
   * Pending invitations are only returned to the OWNER.
   */
  getMembersAndInvites: protectedProcedure
    .input(z.object({ listId: z.string().uuid("Invalid list ID format.") }))
    .query(async ({ input, ctx }) => {
      const userRole = await listPermissionService.requireCanReadList(
        ctx.user.id,
        input.listId
      );

      const list = await todoListRepository.findById(input.listId);
      if (!list) {
        throw new NotFoundError(`Todo list with ID ${input.listId} was not found.`);
      }

      // Retrieve owner email
      const [ownerUser] = (await db.execute(sql`
        SELECT email FROM auth.users WHERE id = ${list.userId}::uuid LIMIT 1;
      `)) as unknown as Array<{ email: string }>;

      const members = await listMemberRepository.findAllByListId(input.listId);

      const invitations =
        userRole === "OWNER"
          ? await invitationRepository.findPendingByListId(input.listId)
          : [];

      return {
        listId: list.id,
        listName: list.name,
        currentUserRole: userRole,
        owner: {
          id: list.userId ?? "",
          email: ownerUser?.email ?? "Owner",
        },
        members,
        invitations,
      };
    }),

  /**
   * Dispatches an invitation email to a collaborator.
   * Only the OWNER of the list can invite.
   */
  invite: protectedProcedure
    .input(inviteCollaboratorSchema)
    .mutation(async ({ input, ctx }) => {
      const userEmail = ctx.user.email;
      if (!userEmail) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User email not found in authenticated session.",
        });
      }

      return invitationService.createInvitation(
        input,
        ctx.user.id,
        userEmail
      );
    }),

  /**
   * Revokes a pending invitation.
   * Only the OWNER of the list can revoke invitations.
   */
  revokeInvitation: protectedProcedure
    .input(revokeInvitationSchema)
    .mutation(async ({ input, ctx }) => {
      return invitationService.revokeInvitation(input.invitationId, ctx.user.id);
    }),

  /**
   * Updates a collaborator's role (EDITOR or VIEWER).
   * Only the OWNER of the list can update member roles.
   */
  updateRole: protectedProcedure
    .input(updateMemberRoleSchema)
    .mutation(async ({ input, ctx }) => {
      const member = await listMemberRepository.findById(input.memberId);
      if (!member) {
        throw new NotFoundError("Member record was not found.");
      }

      await listPermissionService.requireOwner(ctx.user.id, member.listId);

      const previousRole = member.role;
      const updated = await listMemberRepository.updateRole(
        member.id,
        input.role
      );
      if (!updated) {
        throw new NotFoundError("Failed to update collaborator role.");
      }

      let listName = "Todo List";
      try {
        if (process.env.DATABASE_URL) {
          const list = await todoListRepository.findById(member.listId);
          if (list) listName = list.name;
        }
      } catch {
        // Fallback in mock tests
      }

      // Log activity
      try {
        await activityService.logActivity({
          listId: member.listId,
          actorId: ctx.user.id,
          action: "MEMBER_ROLE_CHANGED",
          entityType: "MEMBER",
          entityId: member.id,
          metadata: {
            memberUserId: member.userId,
            previousRole,
            newRole: input.role,
          },
        });
      } catch {
        // Safe logging fallback
      }

      // Dispatch in-app notification to member
      try {
        await notificationService.notifyMemberRoleChanged({
          listId: member.listId,
          listName,
          actorId: ctx.user.id,
          actorEmail: ctx.user.email ?? "Owner",
          memberUserId: member.userId,
          newRole: input.role,
        });
      } catch {
        // Safe notification fallback
      }

      return updated;
    }),

  /**
   * Removes a collaborator from the list.
   * Only the OWNER of the list can remove members.
   */
  removeMember: protectedProcedure
    .input(removeMemberSchema)
    .mutation(async ({ input, ctx }) => {
      const member = await listMemberRepository.findById(input.memberId);
      if (!member) {
        throw new NotFoundError("Member record was not found.");
      }

      await listPermissionService.requireOwner(ctx.user.id, member.listId);

      const deleted = await listMemberRepository.deleteMember(member.id);
      if (!deleted) {
        throw new NotFoundError("Failed to remove collaborator.");
      }

      let listName = "Todo List";
      try {
        if (process.env.DATABASE_URL) {
          const list = await todoListRepository.findById(member.listId);
          if (list) listName = list.name;
        }
      } catch {
        // Fallback in mock tests
      }

      // Log activity
      try {
        await activityService.logActivity({
          listId: member.listId,
          actorId: ctx.user.id,
          action: "MEMBER_REMOVED",
          entityType: "MEMBER",
          entityId: member.id,
          metadata: {
            memberUserId: member.userId,
            role: member.role,
          },
        });
      } catch {
        // Safe logging fallback
      }

      // Dispatch in-app notification to removed member
      try {
        await notificationService.notifyMemberRemoved({
          listId: member.listId,
          listName,
          actorId: ctx.user.id,
          actorEmail: ctx.user.email ?? "Owner",
          memberUserId: member.userId,
        });
      } catch {
        // Safe notification fallback
      }

      return { success: true, memberId: input.memberId };
    }),

  /**
   * Allows a collaborator to leave a shared list.
   */
  leaveList: protectedProcedure
    .input(leaveListSchema)
    .mutation(async ({ input, ctx }) => {
      return todoListService.leaveList(input, ctx.user.id);
    }),
});
