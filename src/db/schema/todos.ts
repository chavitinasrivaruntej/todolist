import { pgTable, uuid, varchar, text, timestamp, pgEnum, index, date, integer, unique } from "drizzle-orm/pg-core";
import { todoLists } from "./lists";

/**
 * Todo Status PostgreSQL Enum
 */
export const todoStatusEnum = pgEnum("todo_status", ["TODO", "IN_PROGRESS", "DONE"]);

/**
 * Todo Priority PostgreSQL Enum
 */
export const todoPriorityEnum = pgEnum("todo_priority", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);

/**
 * Todo Table Definition
 * 
 * Represents an individual todo item belonging to exactly one TodoList,
 * with status, priority, optional due date, title, optional description,
 * optional recurrence series linkage, and audit timestamps.
 */
export const todos = pgTable(
  "todos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listId: uuid("list_id")
      .notNull()
      .references(() => todoLists.id, { onDelete: "cascade" }),
    recurrenceRuleId: uuid("recurrence_rule_id"),
    occurrenceNumber: integer("occurrence_number"),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: todoStatusEnum("status").default("TODO").notNull(),
    priority: todoPriorityEnum("priority").default("MEDIUM").notNull(),
    dueDate: date("due_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("todos_list_id_idx").on(table.listId),
    index("todos_list_id_created_at_idx").on(table.listId, table.createdAt),
    index("todos_list_id_due_date_idx").on(table.listId, table.dueDate),
    index("todos_list_id_priority_idx").on(table.listId, table.priority),
    index("todos_recurrence_rule_id_idx").on(table.recurrenceRuleId),
    unique("todos_recurrence_rule_occurrence_unique").on(
      table.recurrenceRuleId,
      table.occurrenceNumber
    ),
    unique("todos_id_list_id_unique").on(table.id, table.listId),
  ]
);

export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;
export type TodoStatus = (typeof todoStatusEnum.enumValues)[number];
export type TodoPriority = (typeof todoPriorityEnum.enumValues)[number];
