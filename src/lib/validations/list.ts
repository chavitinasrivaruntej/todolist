import { z } from "zod";

/**
 * Validation schema for creating a new Todo list.
 * Enforces non-empty trimmed names and character boundaries.
 */
export const createTodoListSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "List name cannot be empty")
    .max(100, "List name cannot exceed 100 characters"),
});

/**
 * Validation schema for renaming an existing Todo list.
 */
export const renameTodoListSchema = z.object({
  id: z.string().uuid("Invalid list ID format"),
  name: z
    .string()
    .trim()
    .min(1, "List name cannot be empty")
    .max(100, "List name cannot exceed 100 characters"),
});

/**
 * Validation schema for deleting a Todo list.
 * Includes optional 'force' flag to safely confirm deletion of lists with tasks.
 */
export const deleteTodoListSchema = z.object({
  id: z.string().uuid("Invalid list ID format"),
  force: z.boolean().optional().default(false),
});

export type CreateTodoListInput = z.infer<typeof createTodoListSchema>;
export type RenameTodoListInput = z.infer<typeof renameTodoListSchema>;
export type DeleteTodoListInput = z.infer<typeof deleteTodoListSchema>;
