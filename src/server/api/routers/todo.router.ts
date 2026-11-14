import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
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
 */
export const todoRouter = createTRPCRouter({
  /**
   * Retrieves all todos belonging to a specific list.
   */
  list: publicProcedure
    .input(getTodosByListSchema)
    .query(async ({ input }) => {
      return todoService.getTodosByList(input);
    }),

  /**
   * Creates a new todo within the specified list.
   */
  create: publicProcedure
    .input(createTodoSchema)
    .mutation(async ({ input }) => {
      return todoService.createTodo(input);
    }),

  /**
   * Updates the status of an existing todo (TODO, IN_PROGRESS, DONE).
   */
  updateStatus: publicProcedure
    .input(updateTodoStatusSchema)
    .mutation(async ({ input }) => {
      return todoService.updateStatus(input);
    }),

  /**
   * Deletes a todo by ID.
   */
  delete: publicProcedure
    .input(deleteTodoSchema)
    .mutation(async ({ input }) => {
      return todoService.deleteTodo(input);
    }),
});
