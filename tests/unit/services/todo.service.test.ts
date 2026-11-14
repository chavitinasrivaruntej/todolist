import { describe, it, expect, vi, beforeEach } from "vitest";
import { TodoService } from "@/server/services/todo.service";
import { type ITodoRepository } from "@/server/repositories/todo.repository";
import { ListPermissionService } from "@/server/services/list-permission.service";
import { type Todo } from "@/db/schema/todos";
import { NotFoundError, ValidationError } from "@/server/errors";

describe("TodoService", () => {
  let mockRepository: ITodoRepository;
  let mockPermissionService: ListPermissionService;
  let service: TodoService;

  const testUserId = "user-test-uuid";
  const mockDate = new Date("2026-01-01T00:00:00.000Z");
  const sampleListId = "123e4567-e89b-42d3-a456-426614174001";
  const sampleTodo: Todo = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    listId: sampleListId,
    title: "Test Todo",
    description: "Test description",
    status: "TODO",
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  beforeEach(() => {
    mockRepository = {
      findAllByListId: vi.fn(),
      findById: vi.fn(),
      findListIdByTodoId: vi.fn().mockResolvedValue(sampleListId),
      create: vi.fn(),
      updateStatus: vi.fn(),
      delete: vi.fn(),
    };

    mockPermissionService = {
      getUserRole: vi.fn().mockResolvedValue("OWNER"),
      requireOwner: vi.fn().mockResolvedValue(undefined),
      requireCanMutateTodos: vi.fn().mockResolvedValue("OWNER"),
      requireCanReadList: vi.fn().mockResolvedValue("OWNER"),
    } as unknown as ListPermissionService;

    service = new TodoService(mockRepository, mockPermissionService);
  });

  describe("getTodosByList", () => {
    it("should return the list of todos when user has read permission", async () => {
      vi.mocked(mockRepository.findAllByListId).mockResolvedValue([sampleTodo]);

      const result = await service.getTodosByList({ listId: sampleListId }, testUserId);

      expect(mockPermissionService.requireCanReadList).toHaveBeenCalledWith(testUserId, sampleListId);
      expect(mockRepository.findAllByListId).toHaveBeenCalledWith(sampleListId);
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
