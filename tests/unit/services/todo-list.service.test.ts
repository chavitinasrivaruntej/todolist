import { describe, it, expect, vi, beforeEach } from "vitest";
import { TodoListService } from "@/server/services/todo-list.service";
import { type ITodoListRepository, type TodoListWithTaskCount } from "@/server/repositories/todo-list.repository";
import { NotFoundError, ValidationError } from "@/server/errors";

describe("TodoListService", () => {
  let mockRepository: ITodoListRepository;
  let service: TodoListService;

  const mockDate = new Date("2026-01-01T00:00:00.000Z");
  const sampleList: TodoListWithTaskCount = {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Projects",
    createdAt: mockDate,
    updatedAt: mockDate,
    taskCount: 3,
  };

  beforeEach(() => {
    mockRepository = {
      findAllWithTaskCounts: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateName: vi.fn(),
      delete: vi.fn(),
      countTasksByListId: vi.fn(),
    };
    service = new TodoListService(mockRepository);
  });

  describe("getLists", () => {
    it("should return lists with task counts from repository", async () => {
      vi.mocked(mockRepository.findAllWithTaskCounts).mockResolvedValue([sampleList]);

      const result = await service.getLists();

      expect(mockRepository.findAllWithTaskCounts).toHaveBeenCalledTimes(1);
      expect(result).toEqual([sampleList]);
    });
  });

  describe("createList", () => {
    it("should create list with trimmed name", async () => {
      vi.mocked(mockRepository.create).mockResolvedValue({
        id: sampleList.id,
        name: "College",
        createdAt: mockDate,
        updatedAt: mockDate,
      });

      const result = await service.createList({ name: "  College  " });

      expect(mockRepository.create).toHaveBeenCalledWith({ name: "College" });
      expect(result.name).toBe("College");
    });

    it("should throw ValidationError when name is solely whitespace", async () => {
      await expect(service.createList({ name: "   " })).rejects.toThrow(ValidationError);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("renameList", () => {
    it("should rename an existing list", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(sampleList);
      vi.mocked(mockRepository.updateName).mockResolvedValue({
        ...sampleList,
        name: "Work Projects",
      });

      const result = await service.renameList({
        id: sampleList.id,
        name: "  Work Projects  ",
      });

      expect(mockRepository.findById).toHaveBeenCalledWith(sampleList.id);
      expect(mockRepository.updateName).toHaveBeenCalledWith(sampleList.id, "Work Projects");
      expect(result.name).toBe("Work Projects");
    });

    it("should throw ValidationError if new name is empty", async () => {
      await expect(
        service.renameList({ id: sampleList.id, name: " " })
      ).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError if list does not exist", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      await expect(
        service.renameList({ id: sampleList.id, name: "New Name" })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("deleteList", () => {
    it("should throw NotFoundError if list does not exist", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      await expect(
        service.deleteList({ id: sampleList.id, force: false })
      ).rejects.toThrow(NotFoundError);
    });

    it("should block deletion and throw ValidationError if list contains tasks and force=false", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(sampleList);
      vi.mocked(mockRepository.countTasksByListId).mockResolvedValue(3);

      await expect(
        service.deleteList({ id: sampleList.id, force: false })
      ).rejects.toThrow(ValidationError);

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it("should allow deletion if list contains tasks when force=true", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(sampleList);
      vi.mocked(mockRepository.countTasksByListId).mockResolvedValue(3);
      vi.mocked(mockRepository.delete).mockResolvedValue(true);

      const result = await service.deleteList({ id: sampleList.id, force: true });

      expect(mockRepository.delete).toHaveBeenCalledWith(sampleList.id);
      expect(result).toEqual({ success: true, id: sampleList.id });
    });

    it("should allow deletion if list is empty even when force=false", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(sampleList);
      vi.mocked(mockRepository.countTasksByListId).mockResolvedValue(0);
      vi.mocked(mockRepository.delete).mockResolvedValue(true);

      const result = await service.deleteList({ id: sampleList.id, force: false });

      expect(mockRepository.delete).toHaveBeenCalledWith(sampleList.id);
      expect(result).toEqual({ success: true, id: sampleList.id });
    });
  });
});

