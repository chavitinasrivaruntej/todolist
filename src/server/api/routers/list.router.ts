import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import {
  createTodoListSchema,
  renameTodoListSchema,
  deleteTodoListSchema,
} from "@/lib/validations/list";
import { todoListService } from "@/server/services/todo-list.service";

/**
 * TodoList tRPC Router.
 * Handles API endpoints for list creation, listing, renaming, and safe deletion.
 */
export const listRouter = createTRPCRouter({
  /**
   * Retrieves all todo lists with their task counts.
   */
  list: publicProcedure.query(async () => {
    return todoListService.getLists();
  }),

  /**
   * Creates a new todo list.
   */
  create: publicProcedure
    .input(createTodoListSchema)
    .mutation(async ({ input }) => {
      return todoListService.createList(input);
    }),

  /**
   * Renames an existing todo list.
   */
  rename: publicProcedure
    .input(renameTodoListSchema)
    .mutation(async ({ input }) => {
      return todoListService.renameList(input);
    }),

  /**
   * Deletes a todo list according to the safe deletion policy.
   */
  delete: publicProcedure
    .input(deleteTodoListSchema)
    .mutation(async ({ input }) => {
      return todoListService.deleteList(input);
    }),
});
