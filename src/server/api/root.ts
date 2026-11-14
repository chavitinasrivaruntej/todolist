import { createTRPCRouter } from "@/server/api/trpc";
import { listRouter } from "@/server/api/routers/list.router";
import { todoRouter } from "@/server/api/routers/todo.router";
import { sharingRouter } from "@/server/api/routers/sharing.router";
import { invitationRouter } from "@/server/api/routers/invitation.router";

/**
 * Primary AppRouter for the application.
 * Aggregates all domain routers: todoList, todo, sharing, and invitation.
 */
export const appRouter = createTRPCRouter({
  todoList: listRouter,
  todo: todoRouter,
  sharing: sharingRouter,
  invitation: invitationRouter,
});

export type AppRouter = typeof appRouter;
