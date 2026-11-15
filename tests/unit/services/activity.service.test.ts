import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActivityService } from "@/server/services/activity.service";
import { type IActivityRepository, type ActivityLogWithActor } from "@/server/repositories/activity.repository";
import { ListPermissionService } from "@/server/services/list-permission.service";
import { NotFoundError, ValidationError } from "@/server/errors";

describe("ActivityService", () => {
  let mockActivityRepo: IActivityRepository;
  let mockPermissionService: ListPermissionService;
  let activityService: ActivityService;

  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://mock:mock@localhost:5432/mock";
    mockActivityRepo = {
      create: vi.fn(),
      findByListId: vi.fn(),
      deleteAllByListId: vi.fn(),
    };

    mockPermissionService = {
      getUserRole: vi.fn(),
      requireOwner: vi.fn(),
      requireCanMutateTodos: vi.fn(),
      requireCanReadList: vi.fn(),
    } as unknown as ListPermissionService;

    activityService = new ActivityService(mockActivityRepo, mockPermissionService);
  });

  describe("logActivity", () => {
    it("should create activity log with provided attributes", async () => {
      const mockResult = {
        id: "act-1",
        listId: "list-1",
        actorId: "user-1",
        action: "TODO_CREATED" as const,
        entityType: "TODO" as const,
        entityId: "todo-1",
        metadata: { title: "Test Task" },
        createdAt: new Date(),
      };

      vi.mocked(mockActivityRepo.create).mockResolvedValue(mockResult);

      const result = await activityService.logActivity({
        listId: "list-1",
        actorId: "user-1",
        action: "TODO_CREATED",
        entityType: "TODO",
        entityId: "todo-1",
        metadata: { title: "Test Task" },
      });

      expect(mockActivityRepo.create).toHaveBeenCalledWith(
        {
          listId: "list-1",
          actorId: "user-1",
          action: "TODO_CREATED",
          entityType: "TODO",
          entityId: "todo-1",
          metadata: { title: "Test Task" },
        },
        undefined
      );
      expect(result).toEqual(mockResult);
    });

    it("should pass transaction executor to repository when provided", async () => {
      const mockTx = {} as any;
      await activityService.logActivity(
        {
          listId: "list-1",
          action: "LIST_CREATED",
          entityType: "LIST",
        },
        mockTx
      );

      expect(mockActivityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          listId: "list-1",
          action: "LIST_CREATED",
        }),
        mockTx
      );
    });
  });

  describe("getActivityByList & Composite Pagination", () => {
    it("should throw NotFoundError if user has no read permission", async () => {
      vi.mocked(mockPermissionService.requireCanReadList).mockRejectedValue(
        new NotFoundError("List not found")
      );

      await expect(
        activityService.getActivityByList({ listId: "list-1" }, "outsider")
      ).rejects.toThrow(NotFoundError);
    });

    it("should return items and nextCursor when row count exceeds limit", async () => {
      vi.mocked(mockPermissionService.requireCanReadList).mockResolvedValue("OWNER");

      const baseDate = new Date("2026-11-15T08:00:00Z");
      const mockRows: ActivityLogWithActor[] = [
        {
          id: "act-3",
          listId: "list-1",
          actorId: "user-1",
          actorEmail: "u1@example.com",
          action: "TODO_CREATED",
          entityType: "TODO",
          entityId: "t-3",
          metadata: {},
          createdAt: new Date(baseDate.getTime() + 2000),
        },
        {
          id: "act-2",
          listId: "list-1",
          actorId: "user-1",
          actorEmail: "u1@example.com",
          action: "TODO_STATUS_CHANGED",
          entityType: "TODO",
          entityId: "t-2",
          metadata: {},
          createdAt: new Date(baseDate.getTime() + 1000),
        },
        // Extra row signaling another page exists
        {
          id: "act-1",
          listId: "list-1",
          actorId: "user-1",
          actorEmail: "u1@example.com",
          action: "LIST_CREATED",
          entityType: "LIST",
          entityId: "list-1",
          metadata: {},
          createdAt: baseDate,
        },
      ];

      vi.mocked(mockActivityRepo.findByListId).mockResolvedValue(mockRows);

      const result = await activityService.getActivityByList(
        { listId: "list-1", limit: 2 },
        "user-1"
      );

      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.id).toBe("act-3");
      expect(result.items[1]?.id).toBe("act-2");
      expect(result.nextCursor).toBeDefined();

      const decoded = activityService.decodeCursor(result.nextCursor!);
      expect(decoded).toEqual({
        createdAt: new Date(baseDate.getTime() + 1000),
        id: "act-2",
      });
    });

    it("should stably handle records sharing the identical timestamp using ID tie-breaker", async () => {
      vi.mocked(mockPermissionService.requireCanReadList).mockResolvedValue("OWNER");

      const sharedTimestamp = new Date("2026-11-15T08:00:00.000Z");
      // Three records with the exact same millisecond timestamp, ordered by ID desc
      const mockRows: ActivityLogWithActor[] = [
        {
          id: "uuid-c",
          listId: "list-1",
          actorId: "u-1",
          actorEmail: "u1@example.com",
          action: "TODO_CREATED",
          entityType: "TODO",
          entityId: "t-c",
          metadata: {},
          createdAt: sharedTimestamp,
        },
        {
          id: "uuid-b",
          listId: "list-1",
          actorId: "u-1",
          actorEmail: "u1@example.com",
          action: "TODO_CREATED",
          entityType: "TODO",
          entityId: "t-b",
          metadata: {},
          createdAt: sharedTimestamp,
        },
        // 3rd item triggers pagination
        {
          id: "uuid-a",
          listId: "list-1",
          actorId: "u-1",
          actorEmail: "u1@example.com",
          action: "TODO_CREATED",
          entityType: "TODO",
          entityId: "t-a",
          metadata: {},
          createdAt: sharedTimestamp,
        },
      ];

      vi.mocked(mockActivityRepo.findByListId).mockResolvedValue(mockRows);

      const result = await activityService.getActivityByList(
        { listId: "list-1", limit: 2 },
        "u-1"
      );

      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.id).toBe("uuid-c");
      expect(result.items[1]?.id).toBe("uuid-b");

      const decoded = activityService.decodeCursor(result.nextCursor!);
      expect(decoded).toEqual({
        createdAt: sharedTimestamp,
        id: "uuid-b",
      });

      // Now verify passing that cursor invokes findByListId with the composite cursor
      const cursorStr = result.nextCursor!;
      await activityService.getActivityByList(
        { listId: "list-1", limit: 2, cursor: cursorStr },
        "u-1"
      );

      expect(mockActivityRepo.findByListId).toHaveBeenLastCalledWith(
        "list-1",
        2,
        { createdAt: sharedTimestamp, id: "uuid-b" }
      );
    });

    it("should handle corrupted cursor gracefully by falling back to undefined", async () => {
      vi.mocked(mockPermissionService.requireCanReadList).mockResolvedValue("OWNER");
      vi.mocked(mockActivityRepo.findByListId).mockResolvedValue([]);

      const result = await activityService.getActivityByList(
        { listId: "list-1", cursor: "not-a-valid-base64-json" },
        "u-1"
      );

      expect(mockActivityRepo.findByListId).toHaveBeenCalledWith(
        "list-1",
        20,
        undefined
      );
      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });
  });
});

