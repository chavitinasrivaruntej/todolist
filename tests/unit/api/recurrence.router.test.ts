import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "@/server/api/root";
import { recurrenceService } from "@/server/services/recurrence.service";
import type { User } from "@supabase/supabase-js";
import { type RecurrenceRule } from "@/db/schema/recurrence";

describe("tRPC API: Recurrence Router", () => {
  const mockUser: User = {
    id: "user-1234-abcd",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const createCaller = (user: User | null = mockUser) =>
    appRouter.createCaller({
      headers: undefined,
      user,
    });

  const sampleListId = "123e4567-e89b-42d3-a456-426614174001";
  const sampleRuleId = "123e4567-e89b-42d3-a456-426614174999";

  const sampleRule: RecurrenceRule = {
    id: sampleRuleId,
    listId: sampleListId,
    frequency: "WEEKLY",
    interval: 1,
    daysOfWeek: [1],
    anchorDayOfMonth: 12,
    anchorMonthOfYear: 1,
    startDate: "2026-01-12",
    endDate: null,
    maxOccurrences: 10,
    occurrencesGenerated: 1,
    lastGeneratedOccurrenceNumber: 1,
    status: "ACTIVE",
    nextDueDate: "2026-01-19",
    baseTitle: "Team Sync",
    baseDescription: "Weekly team checkin",
    basePriority: "HIGH",
    baseTagIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("authentication guard", () => {
    it("should reject unauthenticated calls with UNAUTHORIZED", async () => {
      const unauthedCaller = createCaller(null);
      await expect(
        unauthedCaller.recurrence.getByList({ listId: sampleListId })
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("recurrence.getByList", () => {
    it("should return recurrence rules for the list", async () => {
      vi.spyOn(recurrenceService, "getRulesByList").mockResolvedValue([sampleRule]);

      const caller = createCaller();
      const result = await caller.recurrence.getByList({ listId: sampleListId });

      expect(recurrenceService.getRulesByList).toHaveBeenCalledWith(
        sampleListId,
        mockUser.id
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.baseTitle).toBe("Team Sync");
    });
  });

  describe("recurrence.create", () => {
    it("should call recurrenceService.createRecurringTask and return result", async () => {
      const mockResult = {
        rule: sampleRule,
        initialTodo: {
          id: "todo-1",
          listId: sampleListId,
          title: "Team Sync",
          description: "Weekly checkin",
          priority: "HIGH" as const,
          status: "TODO" as const,
          dueDate: "2026-01-12",
          recurrenceRuleId: sampleRuleId,
          occurrenceNumber: 1,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        },
      };

      vi.spyOn(recurrenceService, "createRecurringTask").mockResolvedValue(
        mockResult
      );

      const caller = createCaller();
      const result = await caller.recurrence.create({
        listId: sampleListId,
        frequency: "WEEKLY",
        interval: 1,
        daysOfWeek: [1],
        startDate: "2026-01-12",
        baseTitle: "Team Sync",
        baseDescription: "Weekly checkin",
        basePriority: "HIGH",
        baseTagIds: [],
      });

      expect(recurrenceService.createRecurringTask).toHaveBeenCalled();
      expect(result.rule.id).toBe(sampleRuleId);
    });
  });

  describe("recurrence.pause and resume", () => {
    it("should call pauseRecurrence", async () => {
      vi.spyOn(recurrenceService, "pauseRecurrence").mockResolvedValue({
        ...sampleRule,
        status: "PAUSED",
      });

      const caller = createCaller();
      const result = await caller.recurrence.pause({ id: sampleRuleId });

      expect(recurrenceService.pauseRecurrence).toHaveBeenCalledWith(
        sampleRuleId,
        mockUser.id
      );
      expect(result.status).toBe("PAUSED");
    });

    it("should call resumeRecurrence", async () => {
      vi.spyOn(recurrenceService, "resumeRecurrence").mockResolvedValue({
        ...sampleRule,
        status: "ACTIVE",
      });

      const caller = createCaller();
      const result = await caller.recurrence.resume({ id: sampleRuleId });

      expect(recurrenceService.resumeRecurrence).toHaveBeenCalledWith(
        sampleRuleId,
        mockUser.id
      );
      expect(result.status).toBe("ACTIVE");
    });
  });

  describe("recurrence.syncCatchUp", () => {
    it("should call syncCatchUp with client date", async () => {
      vi.spyOn(recurrenceService, "syncCatchUp").mockResolvedValue({
        generatedCount: 2,
      });

      const caller = createCaller();
      const result = await caller.recurrence.syncCatchUp({
        listId: sampleListId,
        clientToday: "2026-01-20",
      });

      expect(recurrenceService.syncCatchUp).toHaveBeenCalledWith(
        sampleListId,
        mockUser.id,
        "2026-01-20"
      );
      expect(result.generatedCount).toBe(2);
    });
  });
});
