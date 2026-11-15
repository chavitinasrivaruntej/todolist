import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { activityService } from "@/server/services/activity.service";

export const activityRouter = createTRPCRouter({
  /**
   * Retrieves chronological activity logs for a specific list.
   * Uses composite keyset pagination (createdAt + id) and validates read permissions.
   */
  listByList: protectedProcedure
    .input(
      z.object({
        listId: z.string().uuid("Invalid list ID format."),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      return activityService.getActivityByList(input, ctx.user.id);
    }),
});

