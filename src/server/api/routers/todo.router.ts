import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { createTodoSchema, deleteTodoSchema } from "@/lib/validations/todo";
import { todoService } from "@/server/services/todo.service";

/**
 * Todo tRPC router.
 * Acts as the API transport layer, validating inputs with Zod schemas and
 * delegating business logic execution to TodoService.
 */
export const todoRouter = createTRPCRouter({
  /**
   * Query to list all todos
   */
  list: publicProcedure.query(async () => {
    return todoService.getTodos();
  }),

  /**
   * Mutation to create a new todo
   */
  create: publicProcedure
    .input(createTodoSchema)
    .mutation(async ({ input }) => {
      return todoService.createTodo(input);
    }),

  /**
   * Mutation to delete a todo by ID
   */
  delete: publicProcedure
    .input(deleteTodoSchema)
    .mutation(async ({ input }) => {
      return todoService.deleteTodo(input);
    }),
});

