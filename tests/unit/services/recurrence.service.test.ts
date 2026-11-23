import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecurrenceService } from "@/server/services/recurrence.service";
import { type IRecurrenceRepository } from "@/server/repositories/recurrence.repository";
import { type ITodoRepository } from "@/server/repositories/todo.repository";
import { type ITagRepository } from "@/server/repositories/tag.repository";
import { ListPermissionService } from "@/server/services/list-permission.service";
import { ActivityService } from "@/server/services/activity.service";
import { type RecurrenceRule } from "@/db/schema/recurrence";
import { type Todo } from "@/db/schema/todos";
import { NotFoundError, ValidationError } from "@/server/errors";

describe("RecurrenceService", () => {
  let mockRecurrenceRepo: IRecurrenceRepository;
  let mockTodoRepo: ITodoRepository;
  let mockTagRepo: ITagRepository;
  let mockPermissionService: ListPermissionService;
  let mockActivityService: ActivityService;
  let service: RecurrenceService;

  const testUserId = "user-uuid-123";
  const sampleListId = "123e4567-e89b-42d3-a456-426614174001";
  const sampleRuleId = "123e4567-e89b-42d3-a456-426614174999";
  const sampleTodoId = "123e4567-e89b-42d3-a456-426614174888";

  const sampleRule: RecurrenceRule = {
    id: sampleRuleId,
    listId: sampleListId,
    frequency: "WEEKLY",
    interval: 1,
    daysOfWeek: [1], // Monday
    anchorDayOfMonth: 12,
    anchorMonthOfYear: 1,
    startDate: "2026-01-12",
    endDate: null,
    maxOccurrences: 5,
    occurrencesGenerated: 1,
    lastGeneratedOccurrenceNumber: 1,
    status: "ACTIVE",
    nextDueDate: "2026-01-19",
    baseTitle: "Weekly Sync",
    baseDescription: "Weekly team sync",
    basePriority: "HIGH",
    baseTagIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleTodo: Todo = {
    id: sampleTodoId,
    listId: sampleListId,
    title: "Weekly Sync",
    description: "Weekly team sync",
    status: "TODO",
    priority: "HIGH",
    dueDate: "2026-01-12",
    recurrenceRuleId: sampleRuleId,
    occurrenceNumber: 1,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockRecurrenceRepo = {
      createRule: vi.fn().mockResolvedValue(sampleRule),
      findById: vi.fn().mockResolvedValue(sampleRule),
      findByIdForUpdate: vi.fn().mockResolvedValue(sampleRule),
      findByListId: vi.fn().mockResolvedValue([sampleRule]),
      updateRule: vi.fn().mockResolvedValue(sampleRule),
      deleteRule: vi.fn().mockResolvedValue(true),
      findDueActiveRules: vi.fn().mockResolvedValue([sampleRule]),
    };

    mockTodoRepo = {
      findAllByListId: vi.fn().mockResolvedValue([{ ...sampleTodo, tags: [] }]),
      findById: vi.fn().mockResolvedValue({ ...sampleTodo, tags: [] }),
      findListIdByTodoId: vi.fn().mockResolvedValue(sampleListId),
      create: vi.fn().mockResolvedValue(sampleTodo),
      updateStatus: vi.fn().mockResolvedValue(sampleTodo),
      updateDetails: vi.fn().mockResolvedValue(sampleTodo),
      delete: vi.fn().mockResolvedValue(true),
      findByRecurrenceRuleAndOccurrence: vi.fn().mockResolvedValue(null),
      findActiveOccurrenceByRuleId: vi.fn().mockResolvedValue(null),
      detachRecurrence: vi.fn().mockResolvedValue({
        ...sampleTodo,
        recurrenceRuleId: null,
        occurrenceNumber: null,
      }),
    };

    mockTagRepo = {
      findAllByListId: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      findByNameAndListId: vi.fn().mockResolvedValue(null),
      findByIdsAndListId: vi.fn().mockResolvedValue([]),
      findTagsForTodo: vi.fn().mockResolvedValue([]),
      findTagsForTodos: vi.fn().mockResolvedValue(new Map()),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      assignTagsToTodo: vi.fn(),
      syncTagsForTodo: vi.fn(),
    };

    mockPermissionService = {
      getUserRole: vi.fn().mockResolvedValue("OWNER"),
      requireOwner: vi.fn().mockResolvedValue(undefined),
      requireCanMutateTodos: vi.fn().mockResolvedValue("OWNER"),
      requireCanReadList: vi.fn().mockResolvedValue("OWNER"),
    } as unknown as ListPermissionService;

    mockActivityService = {
      logActivity: vi.fn().mockResolvedValue({}),
    } as unknown as ActivityService;

    service = new RecurrenceService(
      mockRecurrenceRepo,
      mockTodoRepo,
      mockTagRepo,
      mockPermissionService,
      mockActivityService,
      undefined as any
    );
  });

  describe("createRecurringTask", () => {
    it("should create a recurrence rule, initial todo #1, and log activity", async () => {
      const result = await service.createRecurringTask(
        {
          listId: sampleListId,
          baseTitle: "Weekly Sync",
          baseDescription: "Weekly team sync",
          basePriority: "HIGH",
          frequency: "WEEKLY",
          interval: 1,
          daysOfWeek: [1],
          startDate: "2026-01-12",
          maxOccurrences: 5,
          baseTagIds: [],
        },
        testUserId
      );

      expect(mockPermissionService.requireCanMutateTodos).toHaveBeenCalledWith(
        testUserId,
        sampleListId
      );
      expect(mockRecurrenceRepo.createRule).toHaveBeenCalled();
      expect(mockTodoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          listId: sampleListId,
          title: "Weekly Sync",
          status: "TODO",
          dueDate: "2026-01-12",
          occurrenceNumber: 1,
        }),
        undefined
      );
      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "RECURRENCE_CREATED",
          entityType: "RECURRENCE",
        }),
        undefined
      );
      expect(result.rule).toEqual(sampleRule);
    });

    it("should throw ValidationError if title is whitespace only", async () => {
      await expect(
        service.createRecurringTask(
          {
            listId: sampleListId,
            baseTitle: "   ",
            basePriority: "MEDIUM",
            frequency: "DAILY",
            interval: 1,
            startDate: "2026-01-12",
            baseTagIds: [],
          },
          testUserId
        )
      ).rejects.toThrow(ValidationError);
    });

    it("should propagate error when user lacks mutate permission", async () => {
      vi.mocked(mockPermissionService.requireCanMutateTodos).mockRejectedValue(
        new ValidationError("Viewer not allowed")
      );

      await expect(
        service.createRecurringTask(
          {
            listId: sampleListId,
            baseTitle: "Clean room",
            basePriority: "MEDIUM",
            frequency: "DAILY",
            interval: 1,
            startDate: "2026-01-12",
            baseTagIds: [],
          },
          testUserId
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("handleTaskCompletion", () => {
    it("should generate next occurrence #2 when task #1 is completed", async () => {
      const completedTodo = { ...sampleTodo, status: "DONE" as const };
      const generatedTodo = {
        ...sampleTodo,
        id: "todo-2",
        occurrenceNumber: 2,
        dueDate: "2026-01-19",
      };
      vi.mocked(mockTodoRepo.create).mockResolvedValue(generatedTodo);

      const nextTodo = await service.handleTaskCompletion(
        completedTodo,
        testUserId,
        undefined as any
      );

      expect(mockRecurrenceRepo.findByIdForUpdate).toHaveBeenCalledWith(
        sampleRuleId,
        undefined
      );
      expect(mockTodoRepo.findByRecurrenceRuleAndOccurrence).toHaveBeenCalledWith(
        sampleRuleId,
        2,
        undefined
      );
      expect(mockTodoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recurrenceRuleId: sampleRuleId,
          occurrenceNumber: 2,
          dueDate: "2026-01-19",
        }),
        undefined
      );
      expect(mockRecurrenceRepo.updateRule).toHaveBeenCalledWith(
        sampleRuleId,
        expect.objectContaining({
          occurrencesGenerated: 2,
          lastGeneratedOccurrenceNumber: 2,
        }),
        undefined
      );
      expect(nextTodo).toEqual(generatedTodo);
    });

    it("should return existing next occurrence if already created (idempotency)", async () => {
      const existingNextTodo = {
        ...sampleTodo,
        id: "todo-2",
        occurrenceNumber: 2,
      };
      vi.mocked(
        mockTodoRepo.findByRecurrenceRuleAndOccurrence
      ).mockResolvedValue(existingNextTodo);

      const result = await service.handleTaskCompletion(
        sampleTodo,
        testUserId,
        undefined as any
      );

      expect(result).toEqual(existingNextTodo);
      expect(mockTodoRepo.create).not.toHaveBeenCalled();
    });

    it("should complete rule and not generate when maxOccurrences reached", async () => {
      vi.mocked(mockRecurrenceRepo.findByIdForUpdate).mockResolvedValue({
        ...sampleRule,
        maxOccurrences: 5,
        occurrencesGenerated: 5,
      });

      const result = await service.handleTaskCompletion(
        sampleTodo,
        testUserId,
        undefined as any
      );

      expect(result).toBeNull();
      expect(mockRecurrenceRepo.updateRule).toHaveBeenCalledWith(
        sampleRuleId,
        expect.objectContaining({
          status: "COMPLETED",
          nextDueDate: null,
        }),
        undefined
      );
    });

    it("should return null if rule is PAUSED", async () => {
      vi.mocked(mockRecurrenceRepo.findByIdForUpdate).mockResolvedValue({
        ...sampleRule,
        status: "PAUSED",
      });

      const result = await service.handleTaskCompletion(
        sampleTodo,
        testUserId,
        undefined as any
      );

      expect(result).toBeNull();
      expect(mockTodoRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("pause, resume, and end recurrence", () => {
    it("should pause an active recurrence rule", async () => {
      const result = await service.pauseRecurrence(sampleRuleId, testUserId);
      expect(mockPermissionService.requireCanMutateTodos).toHaveBeenCalledWith(
        testUserId,
        sampleListId
      );
      expect(mockRecurrenceRepo.updateRule).toHaveBeenCalledWith(
        sampleRuleId,
        expect.objectContaining({ status: "PAUSED" })
      );
      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: "RECURRENCE_PAUSED" })
      );
      expect(result).toEqual(sampleRule);
    });

    it("should resume a paused recurrence rule", async () => {
      vi.mocked(mockRecurrenceRepo.findById).mockResolvedValue({
        ...sampleRule,
        status: "PAUSED",
      });

      await service.resumeRecurrence(sampleRuleId, testUserId);
      expect(mockRecurrenceRepo.updateRule).toHaveBeenCalledWith(
        sampleRuleId,
        expect.objectContaining({ status: "ACTIVE" })
      );
      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: "RECURRENCE_RESUMED" })
      );
    });

    it("should end recurrence rule permanently", async () => {
      await service.endRecurrence(sampleRuleId, testUserId);
      expect(mockRecurrenceRepo.updateRule).toHaveBeenCalledWith(
        sampleRuleId,
        expect.objectContaining({ status: "COMPLETED", nextDueDate: null })
      );
      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: "RECURRENCE_ENDED" })
      );
    });
  });

  describe("detachRecurrence", () => {
    it("should unlink a todo from its recurring series", async () => {
      const result = await service.detachRecurrence(sampleTodoId, testUserId);
      expect(mockPermissionService.requireCanMutateTodos).toHaveBeenCalledWith(
        testUserId,
        sampleListId
      );
      expect(mockTodoRepo.detachRecurrence).toHaveBeenCalledWith(sampleTodoId);
      expect(result.recurrenceRuleId).toBeNull();
    });
  });

  describe("syncCatchUp", () => {
    it("should generate due occurrences when no active uncompleted occurrence exists", async () => {
      vi.mocked(mockRecurrenceRepo.findByListId).mockResolvedValue([
        {
          ...sampleRule,
          nextDueDate: "2026-01-19",
          status: "ACTIVE",
        },
      ]);
      vi.mocked(mockTodoRepo.findActiveOccurrenceByRuleId).mockResolvedValue(null);

      const result = await service.syncCatchUp(
        sampleListId,
        testUserId,
        "2026-01-20"
      );

      expect(result.generatedCount).toBe(1);
      expect(mockTodoRepo.create).toHaveBeenCalled();
    });

    it("should not generate new occurrence if current occurrence is still active (uncompleted)", async () => {
      vi.mocked(mockRecurrenceRepo.findByListId).mockResolvedValue([
        {
          ...sampleRule,
          nextDueDate: "2026-01-19",
          status: "ACTIVE",
        },
      ]);
      vi.mocked(mockTodoRepo.findActiveOccurrenceByRuleId).mockResolvedValue(sampleTodo);

      const result = await service.syncCatchUp(
        sampleListId,
        testUserId,
        "2026-01-20"
      );

      expect(result.generatedCount).toBe(0);
      expect(mockTodoRepo.create).not.toHaveBeenCalled();
    });
  });
});
