import { describe, it, expect, vi, beforeEach } from "vitest";
import { TodoService } from "@/server/services/todo.service";
import { type ITodoRepository } from "@/server/repositories/todo.repository";
import { type Todo } from "@/db/schema/todos";
import { TRPCError } from "@trpc/server";

describe("TodoService", () => {
  let mockRepository: ITodoRepository;
  let service: TodoService;

  const mockDate = new Date("2026-01-01T00:00:00.000Z");
  const sampleTodo: Todo = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    title: "Test Todo",
    description: "Test description",
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  beforeEach(() => {
    mockRepository = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    };
    service = new TodoService(mockRepository);
  });

  describe("getTodos", () => {
    it("should return the list of todos from repository", async () => {
      vi.mocked(mockRepository.findAll).mockResolvedValue([sampleTodo]);

      const result = await service.getTodos();

      expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual([sampleTodo]);
    });
  });

  describe("createTodo", () => {
    it("should create a todo through the repository with trimmed title", async () => {
      vi.mocked(mockRepository.create).mockResolvedValue(sampleTodo);

      const result = await service.createTodo({
        title: "  Test Todo  ",
        description: "Test description",
      });

      expect(mockRepository.create).toHaveBeenCalledWith({
        title: "Test Todo",
        description: "Test description",
      });
      expect(result).toEqual(sampleTodo);
    });

    it("should throw BAD_REQUEST when title is empty or only whitespace", async () => {
      await expect(
        service.createTodo({
          title: "   ",
          description: undefined,
        })
      ).rejects.toThrowError(TRPCError);

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("deleteTodo", () => {
    it("should delete existing todo and return success", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(sampleTodo);
      vi.mocked(mockRepository.delete).mockResolvedValue(true);

      const result = await service.deleteTodo({ id: sampleTodo.id });

      expect(mockRepository.findById).toHaveBeenCalledWith(sampleTodo.id);
      expect(mockRepository.delete).toHaveBeenCalledWith(sampleTodo.id);
      expect(result).toEqual({ success: true, id: sampleTodo.id });
    });

    it("should throw NOT_FOUND TRPCError if todo does not exist", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      await expect(
        service.deleteTodo({ id: "123e4567-e89b-12d3-a456-426614174000" })
      ).rejects.toThrowError(
        expect.objectContaining({
          code: "NOT_FOUND",
        })
      );

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it("should throw INTERNAL_SERVER_ERROR if repository delete fails", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(sampleTodo);
      vi.mocked(mockRepository.delete).mockResolvedValue(false);

      await expect(
        service.deleteTodo({ id: sampleTodo.id })
      ).rejects.toThrowError(
        expect.objectContaining({
          code: "INTERNAL_SERVER_ERROR",
        })
      );
    });
  });
});
