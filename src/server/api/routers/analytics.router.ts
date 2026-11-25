import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { analyticsService } from "@/server/services/analytics.service";
import {
  getAnalyticsOverviewInputSchema,
  getAnalyticsVelocityInputSchema,
} from "@/lib/validations/analytics";

export const analyticsRouter = createTRPCRouter({
  /**
   * Returns current-state overview metrics and status/priority/tag distributions
   * for either a specific authorized list or all accessible lists.
   */
  getOverview: protectedProcedure
    .input(getAnalyticsOverviewInputSchema.optional())
    .query(async ({ input, ctx }) => {
      return analyticsService.getOverview(ctx.user.id, input?.listId ?? null);
    }),

  /**
   * Returns historical weekly velocity (created vs. completion events)
   * across Monday-aligned UTC calendar weeks for the selected reporting range.
   */
  getVelocity: protectedProcedure
    .input(getAnalyticsVelocityInputSchema.optional())
    .query(async ({ input, ctx }) => {
      return analyticsService.getVelocity(
        ctx.user.id,
        input?.listId ?? null,
        input?.range ?? "90d"
      );
    }),
});
