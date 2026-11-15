import { z } from "zod";

export const TODO_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export type TodoStatusType = (typeof TODO_STATUSES)[number];

/**
 * Validation schema for retrieving todos belonging to a specific list.
 */
export const getTodosByListSchema = z.object({
  listId: z.string().uuid("Invalid list ID format"),
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
});

/**
 * Validation schema for updating a Todo's status.
 */
export const updateTodoStatusSchema = z.object({
  id: z.string().uuid("Invalid todo ID format"),
  status: z.enum(TODO_STATUSES),
});

/**
 * Validation schema for updating a Todo's title and description.
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
});

/**
 * Validation schema for deleting a Todo item.
 */
export const deleteTodoSchema = z.object({
  id: z.string().uuid("Invalid todo ID format"),
});

export type GetTodosByListInput = z.infer<typeof getTodosByListSchema>;
export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoStatusInput = z.infer<typeof updateTodoStatusSchema>;
export type UpdateTodoDetailsInput = z.infer<typeof updateTodoDetailsSchema>;
export type DeleteTodoInput = z.infer<typeof deleteTodoSchema>;
