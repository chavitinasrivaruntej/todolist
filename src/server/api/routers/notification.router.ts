import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { notificationService } from "@/server/services/notification.service";

export const notificationRouter = createTRPCRouter({
  /**
   * Retrieves paginated in-app notifications for the authenticated user.
   */
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      return notificationService.getNotifications(ctx.user.id, input);
    }),

  /**
   * Retrieves the count of unread notifications for the bell badge.
   */
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await notificationService.getUnreadCount(ctx.user.id);
    return { count };
  }),

  /**
   * Marks a single notification as read.
   */
  markAsRead: protectedProcedure
    .input(z.object({ id: z.string().uuid("Invalid notification ID format.") }))
    .mutation(async ({ input, ctx }) => {
      const success = await notificationService.markAsRead(input.id, ctx.user.id);
      return { success, id: input.id };
    }),

  /**
   * Marks all unread notifications as read.
   */
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const updatedCount = await notificationService.markAllAsRead(ctx.user.id);
    return { success: true, updatedCount };
  }),

  /**
   * Deletes a notification from the inbox.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid("Invalid notification ID format.") }))
    .mutation(async ({ input, ctx }) => {
      const success = await notificationService.deleteNotification(
        input.id,
        ctx.user.id
      );
      return { success, id: input.id };
    }),
});

