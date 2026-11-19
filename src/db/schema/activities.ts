import { pgTable, uuid, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { todoLists } from "./lists";

export type ActivityAction =
  | "TODO_CREATED"
  | "TODO_UPDATED"
  | "TODO_STATUS_CHANGED"
  | "TODO_DELETED"
  | "LIST_CREATED"
  | "LIST_RENAMED"
  | "INVITATION_CREATED"
  | "INVITATION_ACCEPTED"
  | "INVITATION_REVOKED"
  | "MEMBER_JOINED"
  | "MEMBER_REMOVED"
  | "MEMBER_LEFT"
  | "MEMBER_ROLE_CHANGED"
  | "TAG_CREATED"
  | "TAG_UPDATED"
  | "TAG_DELETED";

export type ActivityEntityType = "TODO" | "LIST" | "INVITATION" | "MEMBER" | "TAG";

/**
 * ActivityLogs Table Definition
 *
 * Stores immutable, append-only chronological history of actions on a list.
 * Scoped strictly to the parent list; deleting a list cascades and cleans up all logs.
 */
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listId: uuid("list_id")
      .notNull()
      .references(() => todoLists.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id"),
    action: varchar("action", { length: 50 }).notNull().$type<ActivityAction>(),
    entityType: varchar("entity_type", { length: 30 })
      .notNull()
      .$type<ActivityEntityType>(),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").default({}).notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("activity_logs_list_id_created_at_id_idx").on(
      table.listId,
      table.createdAt.desc(),
      table.id.desc()
    ),
    index("activity_logs_actor_id_idx").on(table.actorId),
  ]
);

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;

