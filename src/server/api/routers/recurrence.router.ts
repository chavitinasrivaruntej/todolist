import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  createRecurrenceRuleSchema,
  updateRecurrenceRuleSchema,
} from "@/lib/validations/recurrence";
import { recurrenceService } from "@/server/services/recurrence.service";

/**
 * Recurrence tRPC router.
 * Manages recurring task templates, schedules, lifecycle transitions, and catch-up synchronization.
 * Gated by authentication and list-level permissions (OWNER, EDITOR, VIEWER).
 */
export const recurrenceRouter = createTRPCRouter({
  /**
   * Retrieves all recurrence rules configured on a list.
   * Accessible by OWNER, EDITOR, and VIEWER roles.
   */
  getByList: protectedProcedure
    .input(z.object({ listId: z.string().uuid("Invalid List ID format.") }))
    .query(async ({ input, ctx }) => {
      return recurrenceService.getRulesByList(input.listId, ctx.user.id);
    }),

  /**
   * Retrieves an individual recurrence rule by ID.
   * Accessible by OWNER, EDITOR, and VIEWER roles.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid("Invalid Recurrence Rule ID format.") }))
    .query(async ({ input, ctx }) => {
      return recurrenceService.getRuleById(input.id, ctx.user.id);
    }),

  /**
   * Creates a recurring task schedule along with its initial occurrence (#1).
   * Gated strictly to OWNER and EDITOR roles.
   */
  create: protectedProcedure
    .input(createRecurrenceRuleSchema)
    .mutation(async ({ input, ctx }) => {
      return recurrenceService.createRecurringTask(input, ctx.user.id);
    }),

  /**
   * Updates an existing recurrence rule schedule template.
   * Gated strictly to OWNER and EDITOR roles.
   */
  update: protectedProcedure
    .input(updateRecurrenceRuleSchema)
    .mutation(async ({ input, ctx }) => {
      return recurrenceService.updateRecurrenceRule(input, ctx.user.id);
    }),

  /**
   * Pauses an active recurrence rule.
   * Gated strictly to OWNER and EDITOR roles.
   */
  pause: protectedProcedure
    .input(z.object({ id: z.string().uuid("Invalid Recurrence Rule ID format.") }))
    .mutation(async ({ input, ctx }) => {
      return recurrenceService.pauseRecurrence(input.id, ctx.user.id);
    }),

  /**
   * Resumes a paused recurrence rule.
   * Gated strictly to OWNER and EDITOR roles.
   */
  resume: protectedProcedure
    .input(z.object({ id: z.string().uuid("Invalid Recurrence Rule ID format.") }))
    .mutation(async ({ input, ctx }) => {
      return recurrenceService.resumeRecurrence(input.id, ctx.user.id);
    }),

  /**
   * Ends a recurrence rule permanently.
   * Gated strictly to OWNER and EDITOR roles.
   */
  end: protectedProcedure
    .input(z.object({ id: z.string().uuid("Invalid Recurrence Rule ID format.") }))
    .mutation(async ({ input, ctx }) => {
      return recurrenceService.endRecurrence(input.id, ctx.user.id);
    }),

  /**
   * Detaches an individual task occurrence from its recurrence series.
   * Gated strictly to OWNER and EDITOR roles.
   */
  detach: protectedProcedure
    .input(z.object({ todoId: z.string().uuid("Invalid Todo ID format.") }))
    .mutation(async ({ input, ctx }) => {
      return recurrenceService.detachRecurrence(input.todoId, ctx.user.id);
    }),

  /**
   * Explicit catch-up trigger to generate any due occurrences.
   * CQRS compliant: explicit command mutation, never a silent write on query.
   * Gated strictly to OWNER and EDITOR roles.
   */
  syncCatchUp: protectedProcedure
    .input(
      z.object({
        listId: z.string().uuid("Invalid List ID format."),
        clientToday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return recurrenceService.syncCatchUp(
        input.listId,
        ctx.user.id,
        input.clientToday
      );
    }),
});
