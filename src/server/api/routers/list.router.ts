import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  createTodoListSchema,
  renameTodoListSchema,
  deleteTodoListSchema,
} from "@/lib/validations/list";
import { todoListService } from "@/server/services/todo-list.service";

/**
 * TodoList tRPC Router.
 * Handles API endpoints for list creation, listing, renaming, and safe deletion.
 * All operations require an authenticated user session and operate strictly on user-owned lists.
 */
export const listRouter = createTRPCRouter({
  /**
   * Retrieves all todo lists with their task counts belonging to the authenticated user.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return todoListService.getLists(ctx.user.id);
  }),

  /**
   * Creates a new todo list owned by the authenticated user.
   */
  create: protectedProcedure
    .input(createTodoListSchema)
    .mutation(async ({ input, ctx }) => {
      return todoListService.createList(input, ctx.user.id);
    }),

  /**
   * Renames an existing todo list owned by the authenticated user.
   */
  rename: protectedProcedure
    .input(renameTodoListSchema)
    .mutation(async ({ input, ctx }) => {
      return todoListService.renameList(input, ctx.user.id);
    }),

  /**
   * Deletes a todo list according to the safe deletion policy.
   */
  delete: protectedProcedure
    .input(deleteTodoListSchema)
    .mutation(async ({ input, ctx }) => {
      return todoListService.deleteList(input, ctx.user.id);
    }),
});
