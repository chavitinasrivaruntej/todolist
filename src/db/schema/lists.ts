import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

/**
 * TodoLists Table Definition
 * 
 * Represents an independent list/workspace of tasks (e.g. College, Personal, Projects).
 */
export const todoLists = pgTable("todo_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type TodoList = typeof todoLists.$inferSelect;
export type NewTodoList = typeof todoLists.$inferInsert;
