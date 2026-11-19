import { describe, it, expect } from "vitest";
import {
  createRecurrenceRuleSchema,
  updateRecurrenceRuleSchema,
} from "@/lib/validations/recurrence";

describe("Recurrence Validations", () => {
  const validListId = "123e4567-e89b-42d3-a456-426614174000";

  describe("createRecurrenceRuleSchema", () => {
    it("should accept valid weekly recurrence configuration", () => {
      const payload = {
        listId: validListId,
        frequency: "WEEKLY" as const,
        interval: 2,
        daysOfWeek: [1, 5],
        startDate: "2026-11-16",
        baseTitle: "Team Standup",
        basePriority: "HIGH" as const,
      };
      const result = createRecurrenceRuleSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should reject interval less than 1", () => {
      const payload = {
        listId: validListId,
        frequency: "DAILY" as const,
        interval: 0,
        startDate: "2026-11-16",
        baseTitle: "Daily sync",
      };
      const result = createRecurrenceRuleSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject interval exceeding bounded maximum (e.g. daily > 365)", () => {
      const payload = {
        listId: validListId,
        frequency: "DAILY" as const,
        interval: 400,
        startDate: "2026-11-16",
        baseTitle: "Daily sync",
      };
      const result = createRecurrenceRuleSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject duplicate weekdays in daysOfWeek", () => {
      const payload = {
        listId: validListId,
        frequency: "WEEKLY" as const,
        interval: 1,
        daysOfWeek: [1, 1, 5],
        startDate: "2026-11-16",
        baseTitle: "Sync",
      };
      const result = createRecurrenceRuleSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject endDate that is earlier than startDate", () => {
      const payload = {
        listId: validListId,
        frequency: "DAILY" as const,
        interval: 1,
        startDate: "2026-11-20",
        endDate: "2026-11-10",
        baseTitle: "Sync",
      };
      const result = createRecurrenceRuleSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject empty baseTitle", () => {
      const payload = {
        listId: validListId,
        frequency: "DAILY" as const,
        interval: 1,
        startDate: "2026-11-20",
        baseTitle: "   ",
      };
      const result = createRecurrenceRuleSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("updateRecurrenceRuleSchema", () => {
    it("should accept valid update payload", () => {
      const payload = {
        id: validListId,
        interval: 3,
        baseTitle: "Updated title",
      };
      const result = updateRecurrenceRuleSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });
});
