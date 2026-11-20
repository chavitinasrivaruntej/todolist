import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { todoLists } from "./lists";
import { todos } from "./todos";

/**
 * Attachment Status PostgreSQL Enum
 * - PENDING_UPLOAD: Slot reserved, signed upload URL issued, awaiting client upload & confirmation.
 * - ACTIVE: Upload verified and active, visible in UI.
 * - PENDING_DELETION: Marked deleted by user, storage deletion in progress or pending retry.
 */
export const attachmentStatusEnum = pgEnum("attachment_status", [
  "PENDING_UPLOAD",
  "ACTIVE",
  "PENDING_DELETION",
]);

/**
 * TodoAttachments Table Definition
 *
 * Stores metadata and lifecycle status for task attachments in Supabase Storage.
 * Uses a composite foreign key on (todoId, listId) referencing todos(id, listId)
 * to guarantee strict multi-tenant boundary integrity and prevent mismatched list associations.
 */
export const todoAttachments = pgTable(
  "todo_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    todoId: uuid("todo_id").notNull(),
    listId: uuid("list_id").notNull(),
    storagePath: varchar("storage_path", { length: 500 }).notNull().unique(),
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    sanitizedFilename: varchar("sanitized_filename", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    fileSize: integer("file_size").notNull(),
    status: attachmentStatusEnum("status").default("PENDING_UPLOAD").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    uploadedBy: uuid("uploaded_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Database-level composite foreign key: guarantees todo_id and list_id match the exact same row in todos
    foreignKey({
      columns: [table.todoId, table.listId],
      foreignColumns: [todos.id, todos.listId],
      name: "todo_attachments_todo_list_fk",
    }).onDelete("cascade"),

    // Direct list foreign key to ensure cascading cleanup if a parent list is dropped
    foreignKey({
      columns: [table.listId],
      foreignColumns: [todoLists.id],
      name: "todo_attachments_list_fk",
    }).onDelete("cascade"),

    // Fast task query index filtered by active status
    index("todo_attachments_todo_status_created_idx").on(
      table.todoId,
      table.status,
      table.createdAt
    ),
    index("todo_attachments_list_id_idx").on(table.listId),
    index("todo_attachments_status_expires_idx").on(table.status, table.expiresAt),
    index("todo_attachments_status_deleted_idx").on(table.status, table.deletedAt),
    index("todo_attachments_uploaded_by_idx").on(table.uploadedBy),
  ]
);

export type TodoAttachment = typeof todoAttachments.$inferSelect;
export type NewTodoAttachment = typeof todoAttachments.$inferInsert;
export type AttachmentStatus = (typeof attachmentStatusEnum.enumValues)[number];
