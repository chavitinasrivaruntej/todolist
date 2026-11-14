import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core";

/**
 * TodoLists Table Definition
 * 
 * Represents an independent list/workspace of tasks (e.g. College, Personal, Projects).
 * Multi-tenant data model: Each list is strictly owned by a user via `userId` referencing `auth.users(id)`.
 */
export const todoLists = pgTable(
  "todo_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id"),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("todo_lists_user_id_idx").on(table.userId),
    index("todo_lists_user_id_created_at_idx").on(table.userId, table.createdAt),
  ]
);

export type TodoList = typeof todoLists.$inferSelect;
export type NewTodoList = typeof todoLists.$inferInsert;
