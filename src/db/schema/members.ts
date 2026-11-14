import { pgTable, uuid, varchar, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { todoLists } from "./lists";

export type ListMemberRole = "EDITOR" | "VIEWER";

/**
 * ListMembers Table Definition
 * 
 * Represents an accepted collaborator membership on a Todo list.
 * The original creator of the list remains the authoritative OWNER in `todo_lists.userId`.
 */
export const listMembers = pgTable(
  "list_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listId: uuid("list_id")
      .notNull()
      .references(() => todoLists.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: varchar("role", { length: 20 }).notNull().$type<ListMemberRole>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("list_members_list_user_unique").on(table.listId, table.userId),
    index("list_members_user_id_idx").on(table.userId),
    index("list_members_list_id_idx").on(table.listId),
  ]
);

export type ListMember = typeof listMembers.$inferSelect;
export type NewListMember = typeof listMembers.$inferInsert;

