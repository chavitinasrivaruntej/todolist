import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  createTagSchema,
  updateTagSchema,
  deleteTagSchema,
} from "@/lib/validations/tag";
import { tagService } from "@/server/services/tag.service";

/**
 * Tag tRPC router.
 * Handles API endpoints for color-coded tags scoped to individual Todo Lists.
 * All endpoints enforce authenticated user sessions and verify list-level permissions.
 */
export const tagRouter = createTRPCRouter({
  /**
   * Retrieves all tags associated with a specific list.
   * Accessible by OWNER, EDITOR, and VIEWER roles.
   */
  listByList: protectedProcedure
    .input(z.object({ listId: z.string().uuid("Invalid List ID format") }))
    .query(async ({ input, ctx }) => {
      return tagService.getTagsByList(input.listId, ctx.user.id);
    }),

  /**
   * Creates a new tag on the specified list.
   * Gated strictly to OWNER and EDITOR roles.
   */
  create: protectedProcedure
    .input(createTagSchema)
    .mutation(async ({ input, ctx }) => {
      return tagService.createTag(input, ctx.user.id);
    }),

  /**
   * Updates an existing tag's name or color.
   * Gated strictly to OWNER and EDITOR roles.
   */
  update: protectedProcedure
    .input(updateTagSchema)
    .mutation(async ({ input, ctx }) => {
      return tagService.updateTag(input, ctx.user.id);
    }),

  /**
   * Deletes a tag from a list and cascades deletion from all associated tasks.
   * Gated strictly to OWNER and EDITOR roles.
   */
  delete: protectedProcedure
    .input(deleteTagSchema)
    .mutation(async ({ input, ctx }) => {
      return tagService.deleteTag(input.id, ctx.user.id);
    }),
});
