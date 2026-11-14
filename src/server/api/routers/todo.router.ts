import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  createTodoSchema,
  deleteTodoSchema,
  getTodosByListSchema,
  updateTodoStatusSchema,
} from "@/lib/validations/todo";
import { todoService } from "@/server/services/todo.service";

/**
 * Todo tRPC router.
 * Handles API endpoints for tasks scoped to individual Todo Lists.
 * All operations require an authenticated user session and verify list/task ownership.
 */
export const todoRouter = createTRPCRouter({
  /**
   * Retrieves all todos belonging to a specific list owned by the authenticated user.
   */
  list: protectedProcedure
    .input(getTodosByListSchema)
    .query(async ({ input, ctx }) => {
      return todoService.getTodosByList(input, ctx.user.id);
    }),

  /**
   * Creates a new todo within the specified list owned by the authenticated user.
   */
  create: protectedProcedure
    .input(createTodoSchema)
    .mutation(async ({ input, ctx }) => {
      return todoService.createTodo(input, ctx.user.id);
    }),

  /**
   * Updates the status of an existing todo (TODO, IN_PROGRESS, DONE) owned by the authenticated user.
   */
  updateStatus: protectedProcedure
    .input(updateTodoStatusSchema)
    .mutation(async ({ input, ctx }) => {
      return todoService.updateStatus(input, ctx.user.id);
    }),

  /**
   * Deletes a todo by ID belonging to a list owned by the authenticated user.
   */
  delete: protectedProcedure
    .input(deleteTodoSchema)
    .mutation(async ({ input, ctx }) => {
      return todoService.deleteTodo(input, ctx.user.id);
    }),
});
