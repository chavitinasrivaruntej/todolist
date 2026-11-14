import { describe, it, expect, vi, beforeEach } from "vitest";
import { TodoService } from "@/server/services/todo.service";
import { type ITodoRepository } from "@/server/repositories/todo.repository";
import { type Todo } from "@/db/schema/todos";
import { NotFoundError, ValidationError } from "@/server/errors";

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
    it("should create a todo through repository with trimmed title and normalized description", async () => {
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

    it("should throw domain-level ValidationError when title is solely whitespace", async () => {
      await expect(
        service.createTodo({
          title: "    ",
          description: undefined,
        })
      ).rejects.toThrow(ValidationError);

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("deleteTodo", () => {
    it("should delete existing todo in a single atomic call and return success", async () => {
      vi.mocked(mockRepository.delete).mockResolvedValue(true);

      const result = await service.deleteTodo({ id: sampleTodo.id });

      // Verifies findById is NOT called (redundant roundtrip eliminated)
      expect(mockRepository.findById).not.toHaveBeenCalled();
      expect(mockRepository.delete).toHaveBeenCalledWith(sampleTodo.id);
      expect(result).toEqual({ success: true, id: sampleTodo.id });
    });

    it("should throw domain-level NotFoundError when record does not exist in database", async () => {
      vi.mocked(mockRepository.delete).mockResolvedValue(false);

      await expect(
        service.deleteTodo({ id: "123e4567-e89b-12d3-a456-426614174000" })
      ).rejects.toThrow(NotFoundError);

      expect(mockRepository.delete).toHaveBeenCalledWith("123e4567-e89b-12d3-a456-426614174000");
    });
  });
});
