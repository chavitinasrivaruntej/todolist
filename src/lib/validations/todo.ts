import { z } from "zod";

/**
 * Validation schema for creating a new Todo item.
 * Enforces non-empty trimmed titles and reasonable character limits.
 */
export const createTodoSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(255, "Title cannot exceed 255 characters"),
  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1000 characters")
    .optional()
    .transform((val) => (val === "" || val === undefined ? undefined : val)),
});

/**
 * Validation schema for deleting a Todo item.
 * Enforces valid UUID format.
 */
export const deleteTodoSchema = z.object({
  id: z.string().uuid("Invalid todo ID format"),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type DeleteTodoInput = z.infer<typeof deleteTodoSchema>;
