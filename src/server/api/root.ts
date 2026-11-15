import { createTRPCRouter } from "@/server/api/trpc";
import { listRouter } from "@/server/api/routers/list.router";
import { todoRouter } from "@/server/api/routers/todo.router";
import { sharingRouter } from "@/server/api/routers/sharing.router";
import { invitationRouter } from "@/server/api/routers/invitation.router";
import { notificationRouter } from "@/server/api/routers/notification.router";
import { activityRouter } from "@/server/api/routers/activity.router";

/**
 * Primary AppRouter for the application.
 * Aggregates domain routers: todoList, todo, sharing, invitation, notification, and activity.
 */
export const appRouter = createTRPCRouter({
  todoList: listRouter,
  todo: todoRouter,
  sharing: sharingRouter,
  invitation: invitationRouter,
  notification: notificationRouter,
  activity: activityRouter,
});

export type AppRouter = typeof appRouter;
