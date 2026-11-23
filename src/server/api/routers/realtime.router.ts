import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { listPermissionService } from "@/server/services/list-permission.service";
import { getListRealtimeTopic } from "@/lib/realtime/realtime-events";

export const realtimeRouter = createTRPCRouter({
  /**
   * Pre-flight authorization for establishing a Supabase Realtime channel subscription.
   * Throws NotFoundError if the user is not an OWNER, EDITOR, or VIEWER of the list,
   * eliminating channel topic probing and UUID enumeration vectors.
   */
  authorizeChannel: protectedProcedure
    .input(
      z.object({
        listId: z.string().uuid("Invalid list ID format"),
      })
    )
    .query(async ({ input, ctx }) => {
      const role = await listPermissionService.requireCanReadList(
        ctx.user.id,
        input.listId
      );

      return {
        authorized: true,
        listId: input.listId,
        topic: getListRealtimeTopic(input.listId),
        role,
        userId: ctx.user.id,
      };
    }),
});
