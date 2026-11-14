import { describe, it, expect, vi, beforeEach } from "vitest";
import { TodoService } from "@/server/services/todo.service";
import { type ITodoRepository } from "@/server/repositories/todo.repository";
import { type ITodoListRepository } from "@/server/repositories/todo-list.repository";
import { type Todo } from "@/db/schema/todos";
import { NotFoundError, ValidationError } from "@/server/errors";

describe("TodoService", () => {
  let mockRepository: ITodoRepository;
  let mockListRepository: ITodoListRepository;
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
      create: vi.fn(),
      updateStatus: vi.fn(),
      delete: vi.fn(),
    };
    mockListRepository = {
      findAllWithTaskCounts: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateName: vi.fn(),
      delete: vi.fn(),
      countTasksByListId: vi.fn(),
    };
    service = new TodoService(mockRepository, mockListRepository);
  });

  describe("getTodosByList", () => {
    it("should return the list of todos when list belongs to user", async () => {
      vi.mocked(mockListRepository.findById).mockResolvedValue({
        id: sampleListId,
        userId: testUserId,
        name: "Test List",
        createdAt: mockDate,
        updatedAt: mockDate,
      });
      vi.mocked(mockRepository.findAllByListId).mockResolvedValue([sampleTodo]);

      const result = await service.getTodosByList({ listId: sampleListId }, testUserId);

      expect(mockListRepository.findById).toHaveBeenCalledWith(sampleListId, testUserId);
      expect(mockRepository.findAllByListId).toHaveBeenCalledWith(sampleListId);
      expect(result).toEqual([sampleTodo]);
    });

    it("should throw NotFoundError when list does not exist for this user", async () => {
      vi.mocked(mockListRepository.findById).mockResolvedValue(null);

      await expect(
        service.getTodosByList({ listId: sampleListId }, testUserId)
      ).rejects.toThrow(NotFoundError);

      expect(mockRepository.findAllByListId).not.toHaveBeenCalled();
    });
  });

  describe("createTodo", () => {
    it("should create a todo through repository when list belongs to user", async () => {
      vi.mocked(mockListRepository.findById).mockResolvedValue({
        id: sampleListId,
        userId: testUserId,
        name: "Test List",
        createdAt: mockDate,
        updatedAt: mockDate,
      });
      vi.mocked(mockRepository.create).mockResolvedValue(sampleTodo);

      const result = await service.createTodo(
        {
          listId: sampleListId,
          title: "  Test Todo  ",
          description: "Test description",
        },
        testUserId
      );

      expect(mockListRepository.findById).toHaveBeenCalledWith(sampleListId, testUserId);
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

    it("should throw domain-level NotFoundError when target list does not exist for user", async () => {
      vi.mocked(mockListRepository.findById).mockResolvedValue(null);

      await expect(
        service.createTodo(
          {
            listId: sampleListId,
            title: "Valid Title",
          },
          testUserId
        )
      ).rejects.toThrow(NotFoundError);

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("updateStatus", () => {
    it("should update status and return updated todo when owned by user", async () => {
      const updatedTodo = { ...sampleTodo, status: "IN_PROGRESS" as const };
      vi.mocked(mockRepository.updateStatus).mockResolvedValue(updatedTodo);

      const result = await service.updateStatus(
        {
          id: sampleTodo.id,
          status: "IN_PROGRESS",
        },
        testUserId
      );

      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        sampleTodo.id,
        "IN_PROGRESS",
        testUserId
      );
      expect(result).toEqual(updatedTodo);
    });

    it("should throw NotFoundError if todo does not exist or not owned by user", async () => {
      vi.mocked(mockRepository.updateStatus).mockResolvedValue(null);

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
    it("should delete existing todo in a single atomic call and return success", async () => {
      vi.mocked(mockRepository.delete).mockResolvedValue(true);

      const result = await service.deleteTodo({ id: sampleTodo.id }, testUserId);

      expect(mockRepository.findById).not.toHaveBeenCalled();
      expect(mockRepository.delete).toHaveBeenCalledWith(sampleTodo.id, testUserId);
      expect(result).toEqual({ success: true, id: sampleTodo.id });
    });

    it("should throw domain-level NotFoundError when record does not exist for this user", async () => {
      vi.mocked(mockRepository.delete).mockResolvedValue(false);

      await expect(
        service.deleteTodo({ id: "123e4567-e89b-12d3-a456-426614174000" }, testUserId)
      ).rejects.toThrow(NotFoundError);

      expect(mockRepository.delete).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174000",
        testUserId
      );
    });
  });
});
