import { createTRPCRouter } from "@/server/api/trpc";
import { listRouter } from "@/server/api/routers/list.router";
import { todoRouter } from "@/server/api/routers/todo.router";
import { sharingRouter } from "@/server/api/routers/sharing.router";
import { invitationRouter } from "@/server/api/routers/invitation.router";
import { notificationRouter } from "@/server/api/routers/notification.router";
import { activityRouter } from "@/server/api/routers/activity.router";
import { tagRouter } from "@/server/api/routers/tag.router";
import { recurrenceRouter } from "@/server/api/routers/recurrence.router";
import { attachmentRouter } from "@/server/api/routers/attachment.router";

/**
 * Primary AppRouter for the application.
 * Aggregates domain routers: todoList, todo, sharing, invitation, notification, activity, tag, recurrence, and attachment.
 */
export const appRouter = createTRPCRouter({
  todoList: listRouter,
  todo: todoRouter,
  sharing: sharingRouter,
  invitation: invitationRouter,
  notification: notificationRouter,
  activity: activityRouter,
  tag: tagRouter,
  recurrence: recurrenceRouter,
  attachment: attachmentRouter,
});

export type AppRouter = typeof appRouter;
