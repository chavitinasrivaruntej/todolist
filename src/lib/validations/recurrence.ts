import { z } from "zod";
import { TODO_PRIORITIES, type TodoPriorityType } from "@/lib/validations/todo";

export const RECURRENCE_FREQUENCIES = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
  "CUSTOM",
] as const;

export type RecurrenceFrequencyType = (typeof RECURRENCE_FREQUENCIES)[number];

export const RECURRENCE_STATUSES = ["ACTIVE", "PAUSED", "COMPLETED"] as const;
export type RecurrenceStatusType = (typeof RECURRENCE_STATUSES)[number];

// ISO Date pattern YYYY-MM-DD
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validation schema for configuring recurrence on a task or list.
 */
export const createRecurrenceRuleSchema = z
  .object({
    listId: z.string().uuid("Invalid List ID format."),
    frequency: z.enum(RECURRENCE_FREQUENCIES),
    interval: z
      .number()
      .int()
      .min(1, "Interval must be at least 1.")
      .default(1),
    daysOfWeek: z
      .array(z.number().int().min(1).max(7))
      .optional()
      .refine(
        (arr) => !arr || arr.length === new Set(arr).size,
        "Duplicate weekdays are not permitted."
      ),
    anchorDayOfMonth: z.number().int().min(1).max(31).optional(),
    anchorMonthOfYear: z.number().int().min(1).max(12).optional(),
    startDate: z
      .string()
      .regex(isoDateRegex, "Start date must be in YYYY-MM-DD format."),
    endDate: z
      .string()
      .regex(isoDateRegex, "End date must be in YYYY-MM-DD format.")
      .nullable()
      .optional(),
    maxOccurrences: z
      .number()
      .int()
      .min(1, "Max occurrences must be at least 1.")
      .max(1000, "Max occurrences cannot exceed 1000.")
      .nullable()
      .optional(),
    baseTitle: z
      .string()
      .trim()
      .min(1, "Task title cannot be empty.")
      .max(255, "Task title must be 255 characters or fewer."),
    baseDescription: z.string().trim().max(1000).nullable().optional(),
    basePriority: z.enum(TODO_PRIORITIES as unknown as [TodoPriorityType, ...TodoPriorityType[]]).default("MEDIUM"),
    baseTagIds: z.array(z.string().uuid()).default([]),
  })
  .refine(
    (data) => {
      if (data.endDate && data.startDate && data.endDate < data.startDate) {
        return false;
      }
      return true;
    },
    {
      message: "End date must be on or after start date.",
      path: ["endDate"],
    }
  )
  .refine(
    (data) => {
      // Validate bounded interval ranges
      if (data.frequency === "DAILY" && data.interval > 365) return false;
      if (data.frequency === "WEEKLY" && data.interval > 52) return false;
      if (data.frequency === "MONTHLY" && data.interval > 60) return false;
      if (data.frequency === "YEARLY" && data.interval > 10) return false;
      return true;
    },
    {
      message: "Interval exceeds maximum permitted bounds for this frequency.",
      path: ["interval"],
    }
  );

export type CreateRecurrenceRuleInput = z.infer<typeof createRecurrenceRuleSchema>;

/**
 * Validation schema for modifying an existing recurrence rule.
 */
export const updateRecurrenceRuleSchema = z
  .object({
    id: z.string().uuid("Invalid Recurrence Rule ID."),
    frequency: z.enum(RECURRENCE_FREQUENCIES).optional(),
    interval: z.number().int().min(1).optional(),
    daysOfWeek: z.array(z.number().int().min(1).max(7)).optional(),
    anchorDayOfMonth: z.number().int().min(1).max(31).optional(),
    anchorMonthOfYear: z.number().int().min(1).max(12).optional(),
    endDate: z.string().regex(isoDateRegex).nullable().optional(),
    maxOccurrences: z.number().int().min(1).max(1000).nullable().optional(),
    baseTitle: z.string().trim().min(1).max(255).optional(),
    baseDescription: z.string().trim().max(1000).nullable().optional(),
    basePriority: z.enum(TODO_PRIORITIES as unknown as [TodoPriorityType, ...TodoPriorityType[]]).optional(),
    baseTagIds: z.array(z.string().uuid()).optional(),
  });

export type UpdateRecurrenceRuleInput = z.infer<typeof updateRecurrenceRuleSchema>;
