import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  date,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { todoLists } from "./lists";
import { todoPriorityEnum } from "./todos";

/**
 * Recurrence Frequency PostgreSQL Enum
 */
export const recurrenceFrequencyEnum = pgEnum("recurrence_frequency", [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
  "CUSTOM",
]);

/**
 * Recurrence Status PostgreSQL Enum
 */
export const recurrenceStatusEnum = pgEnum("recurrence_status", [
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
]);

/**
 * RecurrenceRules Table Definition
 *
 * Stores repeating schedule templates and series counters for recurring tasks.
 * Scoped directly to a parent TodoList; cascading deletion on list removal.
 */
export const recurrenceRules = pgTable(
  "recurrence_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listId: uuid("list_id")
      .notNull()
      .references(() => todoLists.id, { onDelete: "cascade" }),
    frequency: recurrenceFrequencyEnum("frequency").notNull(),
    interval: integer("interval").default(1).notNull(),
    daysOfWeek: jsonb("days_of_week").$type<number[]>(), // 1=Mon .. 7=Sun
    anchorDayOfMonth: integer("anchor_day_of_month"),   // 1..31 (preserves month-end target)
    anchorMonthOfYear: integer("anchor_month_of_year"), // 1..12 (preserves leap-year target)
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    maxOccurrences: integer("max_occurrences"),
    occurrencesGenerated: integer("occurrences_generated").default(0).notNull(),
    lastGeneratedOccurrenceNumber: integer("last_generated_occurrence_number").default(0).notNull(),
    status: recurrenceStatusEnum("status").default("ACTIVE").notNull(),
    nextDueDate: date("next_due_date", { mode: "string" }),
    baseTitle: varchar("base_title", { length: 255 }).notNull(),
    baseDescription: text("base_description"),
    basePriority: todoPriorityEnum("base_priority").default("MEDIUM").notNull(),
    baseTagIds: jsonb("base_tag_ids").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("recurrence_rules_list_id_idx").on(table.listId),
    index("recurrence_rules_status_next_due_idx").on(table.status, table.nextDueDate),
  ]
);

export type RecurrenceRule = typeof recurrenceRules.$inferSelect;
export type NewRecurrenceRule = typeof recurrenceRules.$inferInsert;
export type RecurrenceFrequency = (typeof recurrenceFrequencyEnum.enumValues)[number];
export type RecurrenceStatus = (typeof recurrenceStatusEnum.enumValues)[number];
