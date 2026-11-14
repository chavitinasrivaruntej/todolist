import { createTRPCRouter } from "@/server/api/trpc";
import { todoRouter } from "@/server/api/routers/todo.router";

/**
 * Primary AppRouter for the application.
 * All domain routers are aggregated here.
 */
export const appRouter = createTRPCRouter({
  todo: todoRouter,
});

export type AppRouter = typeof appRouter;

