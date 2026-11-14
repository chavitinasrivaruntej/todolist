import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Todo Table Definition
 * 
 * Represents an individual todo item with an immutable UUID identifier,
 * title, optional description, and audit timestamps.
 */
export const todos = pgTable("todos", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;

