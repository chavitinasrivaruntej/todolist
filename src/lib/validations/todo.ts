import { z } from "zod";

export const TODO_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export type TodoStatusType = (typeof TODO_STATUSES)[number];

export const TODO_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TodoPriorityType = (typeof TODO_PRIORITIES)[number];

export const DUE_DATE_FILTERS = [
  "ALL",
  "OVERDUE",
  "TODAY",
  "THIS_WEEK",
  "NO_DUE_DATE",
] as const;
export type DueDateFilterType = (typeof DUE_DATE_FILTERS)[number];

export const SORT_FIELDS = ["created", "dueDate", "priority", "title"] as const;
export type SortFieldType = (typeof SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirectionType = (typeof SORT_DIRECTIONS)[number];

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be formatted as YYYY-MM-DD")
  .nullish()
  .transform((val) => (val === "" || val === null || val === undefined ? null : val));

/**
 * Validation schema for retrieving todos belonging to a specific list.
 * Supports task search, status/priority/due date filtering, and deterministic sorting.
 */
export const getTodosByListSchema = z.object({
  listId: z.string().uuid("Invalid list ID format"),
  search: z.string().trim().max(100).optional(),
  status: z.enum(TODO_STATUSES).optional(),
  priority: z.enum(TODO_PRIORITIES).optional(),
  dueFilter: z.enum(DUE_DATE_FILTERS).optional().default("ALL"),
  sortBy: z.enum(SORT_FIELDS).optional().default("created"),
  sortDirection: z.enum(SORT_DIRECTIONS).optional().default("desc"),
  clientToday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid client today date format")
    .optional(),
});

/**
 * Validation schema for creating a new Todo item within a specific list.
 */
export const createTodoSchema = z.object({
  listId: z.string().uuid("Invalid list ID format"),
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(255, "Title cannot exceed 255 characters"),
  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1000 characters")
    .nullish()
    .transform((val) => (val === "" || val === null || val === undefined ? undefined : val)),
  status: z.enum(TODO_STATUSES).optional().default("TODO"),
  priority: z.enum(TODO_PRIORITIES).optional().default("MEDIUM"),
  dueDate: dateStringSchema,
});

/**
 * Validation schema for updating a Todo's status.
 */
export const updateTodoStatusSchema = z.object({
  id: z.string().uuid("Invalid todo ID format"),
  status: z.enum(TODO_STATUSES),
});

/**
 * Validation schema for updating a Todo's title, description, priority, and due date.
 */
export const updateTodoDetailsSchema = z.object({
  id: z.string().uuid("Invalid todo ID format"),
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(255, "Title cannot exceed 255 characters")
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1000 characters")
    .nullish()
    .transform((val) => (val === "" || val === null || val === undefined ? null : val)),
  priority: z.enum(TODO_PRIORITIES).optional(),
  dueDate: dateStringSchema,
});

/**
 * Validation schema for deleting a Todo item.
 */
export const deleteTodoSchema = z.object({
  id: z.string().uuid("Invalid todo ID format"),
});

export type GetTodosByListInput = z.input<typeof getTodosByListSchema>;
export type CreateTodoInput = z.input<typeof createTodoSchema>;
export type UpdateTodoStatusInput = z.input<typeof updateTodoStatusSchema>;
export type UpdateTodoDetailsInput = z.input<typeof updateTodoDetailsSchema>;
export type DeleteTodoInput = z.input<typeof deleteTodoSchema>;
