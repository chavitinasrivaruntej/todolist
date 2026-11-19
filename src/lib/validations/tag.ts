import { z } from "zod";
import { TAG_COLORS } from "@/db/schema/tags";

export const tagColorSchema = z.enum(TAG_COLORS as unknown as [string, ...string[]]);

/**
 * Validation schema for creating a new Tag on a TodoList.
 */
export const createTagSchema = z.object({
  listId: z.string().uuid("Invalid List ID format."),
  name: z
    .string()
    .trim()
    .min(1, "Tag name cannot be empty.")
    .max(50, "Tag name must be 50 characters or fewer."),
  color: tagColorSchema.default("slate"),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;

/**
 * Validation schema for updating an existing Tag.
 */
export const updateTagSchema = z.object({
  id: z.string().uuid("Invalid Tag ID format."),
  name: z
    .string()
    .trim()
    .min(1, "Tag name cannot be empty.")
    .max(50, "Tag name must be 50 characters or fewer.")
    .optional(),
  color: tagColorSchema.optional(),
});

export type UpdateTagInput = z.infer<typeof updateTagSchema>;

/**
 * Validation schema for deleting a Tag.
 */
export const deleteTagSchema = z.object({
  id: z.string().uuid("Invalid Tag ID format."),
});

export type DeleteTagInput = z.infer<typeof deleteTagSchema>;

/**
 * Tag filtering options for querying tasks.
 */
export const tagOperatorSchema = z.enum(["AND", "OR"]);
export type TagOperator = z.infer<typeof tagOperatorSchema>;

export const tagFilterSchema = z.object({
  tagIds: z.array(z.string().uuid("Invalid Tag ID format.")).optional(),
  tagOperator: tagOperatorSchema.default("AND"),
});

export type TagFilterInput = z.infer<typeof tagFilterSchema>;
