import { pgTable, uuid, varchar, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { todoLists } from "./lists";

export type NotificationType =
  | "INVITATION_RECEIVED"
  | "INVITATION_ACCEPTED"
  | "MEMBER_REMOVED"
  | "MEMBER_LEFT"
  | "MEMBER_ROLE_CHANGED"
  | "INVITATION_REVOKED";

/**
 * Notifications Table Definition
 *
 * Stores persistent in-app notifications delivered to individual user inboxes.
 * When a parent list is deleted, list_id is set to NULL to preserve notifications.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    actorId: uuid("actor_id"),
    listId: uuid("list_id").references(() => todoLists.id, { onDelete: "set null" }),
    type: varchar("type", { length: 50 }).notNull().$type<NotificationType>(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notifications_user_id_is_read_idx").on(table.userId, table.isRead),
    index("notifications_user_id_created_at_id_idx").on(
      table.userId,
      table.createdAt.desc(),
      table.id.desc()
    ),
    index("notifications_list_id_idx").on(table.listId),
  ]
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

