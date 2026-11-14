import { pgTable, uuid, varchar, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { todoLists } from "./lists";

/**
 * Todo Status PostgreSQL Enum
 */
export const todoStatusEnum = pgEnum("todo_status", ["TODO", "IN_PROGRESS", "DONE"]);

/**
 * Todo Table Definition
 * 
 * Represents an individual todo item belonging to exactly one TodoList,
 * with status, title, optional description, and audit timestamps.
 */
export const todos = pgTable(
  "todos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listId: uuid("list_id")
      .notNull()
      .references(() => todoLists.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: todoStatusEnum("status").default("TODO").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("todos_list_id_idx").on(table.listId),
    index("todos_list_id_created_at_idx").on(table.listId, table.createdAt),
  ]
);

export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;
export type TodoStatus = (typeof todoStatusEnum.enumValues)[number];
