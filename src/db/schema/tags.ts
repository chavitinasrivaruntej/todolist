import { pgTable, uuid, varchar, timestamp, index, unique, primaryKey } from "drizzle-orm/pg-core";
import { todoLists } from "./lists";
import { todos } from "./todos";

/**
 * Predefined Tag Palette Options
 */
export const TAG_COLORS = [
  "slate",
  "red",
  "orange",
  "amber",
  "emerald",
  "teal",
  "blue",
  "indigo",
  "purple",
  "pink",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

/**
 * Tags Table Definition
 *
 * Represents an individual color-coded tag defined on a specific TodoList.
 * Scoped to the list: all collaborators on the list see the same tags.
 */
export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listId: uuid("list_id")
      .notNull()
      .references(() => todoLists.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(),
    color: varchar("color", { length: 30 }).notNull().default("slate"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("tags_list_id_idx").on(table.listId),
    index("tags_list_id_name_idx").on(table.listId, table.name),
    unique("tags_list_id_name_unique").on(table.listId, table.name),
  ]
);

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

/**
 * TodoTags Join Table Definition
 *
 * Associative many-to-many relationship linking a Todo task with one or more Tags.
 */
export const todoTags = pgTable(
  "todo_tags",
  {
    todoId: uuid("todo_id")
      .notNull()
      .references(() => todos.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.todoId, table.tagId] }),
    index("todo_tags_tag_id_idx").on(table.tagId),
    index("todo_tags_todo_id_idx").on(table.todoId),
  ]
);

export type TodoTag = typeof todoTags.$inferSelect;
export type NewTodoTag = typeof todoTags.$inferInsert;
