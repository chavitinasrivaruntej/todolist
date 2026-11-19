import { describe, it, expect, vi, beforeEach } from "vitest";
import { TodoService } from "@/server/services/todo.service";
import { type ITodoRepository } from "@/server/repositories/todo.repository";
import { ListPermissionService } from "@/server/services/list-permission.service";
import { ActivityService } from "@/server/services/activity.service";
import { type TodoWithTags } from "@/server/repositories/todo.repository";
import { NotFoundError, ValidationError } from "@/server/errors";

describe("TodoService", () => {
  let mockRepository: ITodoRepository;
  let mockPermissionService: ListPermissionService;
  let mockActivityService: ActivityService;
  let service: TodoService;

  const testUserId = "user-test-uuid";
  const mockDate = new Date("2026-01-01T00:00:00.000Z");
  const sampleListId = "123e4567-e89b-42d3-a456-426614174001";
  const sampleTodo: TodoWithTags = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    listId: sampleListId,
    title: "Test Todo",
    description: "Test description",
    status: "TODO",
    priority: "MEDIUM",
    dueDate: null,
    createdAt: mockDate,
    updatedAt: mockDate,
    tags: [],
  };

  beforeEach(() => {
    mockRepository = {
      findAllByListId: vi.fn(),
      findById: vi.fn().mockResolvedValue(sampleTodo),
      findListIdByTodoId: vi.fn().mockResolvedValue(sampleListId),
      create: vi.fn(),
      updateStatus: vi.fn(),
      updateDetails: vi.fn(),
      delete: vi.fn(),
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

    service = new TodoService(mockRepository, mockPermissionService, mockActivityService);
  });

  describe("getTodosByList", () => {
    it("should return the list of todos when user has read permission", async () => {
      vi.mocked(mockRepository.findAllByListId).mockResolvedValue([sampleTodo]);

      const result = await service.getTodosByList({ listId: sampleListId }, testUserId);

      expect(mockPermissionService.requireCanReadList).toHaveBeenCalledWith(testUserId, sampleListId);
      expect(mockRepository.findAllByListId).toHaveBeenCalledWith(
        sampleListId,
        expect.objectContaining({
          dueFilter: "ALL",
          sortBy: "created",
          sortDirection: "desc",
        })
      );
      expect(result).toEqual([sampleTodo]);
    });

    it("should throw NotFoundError when list is not accessible to user", async () => {
      vi.mocked(mockPermissionService.requireCanReadList).mockRejectedValue(
        new NotFoundError("List not found")
      );

      await expect(
        service.getTodosByList({ listId: sampleListId }, testUserId)
      ).rejects.toThrow(NotFoundError);

      expect(mockRepository.findAllByListId).not.toHaveBeenCalled();
    });
  });

  describe("createTodo", () => {
    it("should create a todo through repository when user has mutate permission", async () => {
      vi.mocked(mockRepository.create).mockResolvedValue(sampleTodo);

      const result = await service.createTodo(
        {
          listId: sampleListId,
          title: "  Test Todo  ",
          description: "Test description",
        },
        testUserId
      );

      expect(mockPermissionService.requireCanMutateTodos).toHaveBeenCalledWith(testUserId, sampleListId);
      expect(mockRepository.create).toHaveBeenCalledWith({
        listId: sampleListId,
        title: "Test Todo",
        description: "Test description",
        status: "TODO",
        priority: "MEDIUM",
        dueDate: null,
      });
      expect(result).toEqual(sampleTodo);
    });

    it("should throw domain-level ValidationError when title is solely whitespace", async () => {
      await expect(
        service.createTodo(
          {
            listId: sampleListId,
            title: "    ",
            description: undefined,
          },
          testUserId
        )
      ).rejects.toThrow(ValidationError);

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it("should block Viewers from creating tasks with ValidationError", async () => {
      vi.mocked(mockPermissionService.requireCanMutateTodos).mockRejectedValue(
        new ValidationError("Viewers have read-only access and cannot modify tasks.")
      );

      await expect(
        service.createTodo(
          {
            listId: sampleListId,
            title: "Valid Title",
          },
          testUserId
        )
      ).rejects.toThrow(ValidationError);

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("updateStatus", () => {
    it("should update status and return updated todo when user has mutate permission", async () => {
      const updatedTodo = { ...sampleTodo, status: "IN_PROGRESS" as const };
      vi.mocked(mockRepository.updateStatus).mockResolvedValue(updatedTodo);

      const result = await service.updateStatus(
        {
          id: sampleTodo.id,
          status: "IN_PROGRESS",
        },
        testUserId
      );

      expect(mockRepository.findListIdByTodoId).toHaveBeenCalledWith(sampleTodo.id);
      expect(mockPermissionService.requireCanMutateTodos).toHaveBeenCalledWith(testUserId, sampleListId);
      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        sampleTodo.id,
        "IN_PROGRESS"
      );
      expect(result).toEqual(updatedTodo);
    });

    it("should return existing without calling repository.updateStatus if status is unchanged (no-op)", async () => {
      const result = await service.updateStatus(
        {
          id: sampleTodo.id,
          status: "TODO",
        },
        testUserId
      );

      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
      expect(result).toEqual(sampleTodo);
    });

    it("should throw NotFoundError if todo listId cannot be resolved", async () => {
      vi.mocked(mockRepository.findListIdByTodoId).mockResolvedValue(null);

      await expect(
        service.updateStatus(
          {
            id: sampleTodo.id,
            status: "DONE",
          },
          testUserId
        )
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("updateDetails", () => {
    it("should update priority and record previousPriority and newPriority in activity log", async () => {
      const updated = { ...sampleTodo, priority: "URGENT" as const };
      vi.mocked(mockRepository.updateDetails).mockResolvedValue(updated);

      const result = await service.updateDetails(
        {
          id: sampleTodo.id,
          priority: "URGENT",
        },
        testUserId
      );

      expect(mockRepository.updateDetails).toHaveBeenCalledWith(
        sampleTodo.id,
        expect.objectContaining({ priority: "URGENT" })
      );
      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TODO_UPDATED",
          metadata: expect.objectContaining({
            previousPriority: "MEDIUM",
            newPriority: "URGENT",
          }),
        }),
        undefined
      );
      expect(result).toEqual(updated);
    });

    it("should update dueDate and record previousDueDate and newDueDate in activity log", async () => {
      const updated = { ...sampleTodo, dueDate: "2026-11-25" };
      vi.mocked(mockRepository.updateDetails).mockResolvedValue(updated);

      const result = await service.updateDetails(
        {
          id: sampleTodo.id,
          dueDate: "2026-11-25",
        },
        testUserId
      );

      expect(mockRepository.updateDetails).toHaveBeenCalledWith(
        sampleTodo.id,
        expect.objectContaining({ dueDate: "2026-11-25" })
      );
      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TODO_UPDATED",
          metadata: expect.objectContaining({
            previousDueDate: null,
            newDueDate: "2026-11-25",
          }),
        }),
        undefined
      );
      expect(result).toEqual(updated);
    });

    it("should record previousDueDate and newDueDate: null when due date is removed", async () => {
      const existingWithDueDate = { ...sampleTodo, dueDate: "2026-11-20" };
      vi.mocked(mockRepository.findById).mockResolvedValue(existingWithDueDate);

      const updated = { ...existingWithDueDate, dueDate: null };
      vi.mocked(mockRepository.updateDetails).mockResolvedValue(updated);

      const result = await service.updateDetails(
        {
          id: sampleTodo.id,
          dueDate: null,
        },
        testUserId
      );

      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TODO_UPDATED",
          metadata: expect.objectContaining({
            previousDueDate: "2026-11-20",
            newDueDate: null,
          }),
        }),
        undefined
      );
      expect(result).toEqual(updated);
    });

    it("should suppress database update and activity log when no fields have changed (no-op)", async () => {
      const result = await service.updateDetails(
        {
          id: sampleTodo.id,
          title: sampleTodo.title,
          description: sampleTodo.description,
          priority: sampleTodo.priority,
          dueDate: sampleTodo.dueDate,
        },
        testUserId
      );

      expect(mockRepository.updateDetails).not.toHaveBeenCalled();
      expect(mockActivityService.logActivity).not.toHaveBeenCalled();
      expect(result).toEqual(sampleTodo);
    });
  });

  describe("deleteTodo", () => {
    it("should delete existing todo when user has mutate permission", async () => {
      vi.mocked(mockRepository.delete).mockResolvedValue(true);

      const result = await service.deleteTodo({ id: sampleTodo.id }, testUserId);

      expect(mockRepository.findListIdByTodoId).toHaveBeenCalledWith(sampleTodo.id);
      expect(mockPermissionService.requireCanMutateTodos).toHaveBeenCalledWith(testUserId, sampleListId);
      expect(mockRepository.delete).toHaveBeenCalledWith(sampleTodo.id);
      expect(result).toEqual({ success: true, id: sampleTodo.id });
    });

    it("should throw domain-level NotFoundError when record does not exist", async () => {
      vi.mocked(mockRepository.findListIdByTodoId).mockResolvedValue(null);

      await expect(
        service.deleteTodo({ id: "123e4567-e89b-12d3-a456-426614174000" }, testUserId)
      ).rejects.toThrow(NotFoundError);
    });
  });
});
