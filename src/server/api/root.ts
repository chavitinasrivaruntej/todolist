import { createTRPCRouter } from "@/server/api/trpc";
import { listRouter } from "@/server/api/routers/list.router";
import { todoRouter } from "@/server/api/routers/todo.router";

/**
 * Primary AppRouter for the application.
 * Aggregates all domain routers: todoList and todo.
 */
export const appRouter = createTRPCRouter({
  todoList: listRouter,
  todo: todoRouter,
});

export type AppRouter = typeof appRouter;
