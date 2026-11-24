import { describe, it, expect, vi } from "vitest";
import { TodoRepository } from "@/server/repositories/todo.repository";
import { type Database } from "@/db";
import { todos } from "@/db/schema/todos";

describe("TodoRepository", () => {
  const sampleListId = "11111111-1111-1111-1111-111111111111";

  describe("delete", () => {
    it("should execute DELETE with RETURNING and return deleted record when row was deleted", async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: "test-uuid", listId: sampleListId, version: 3 }]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });

      const mockDb = {
        delete: mockDelete,
      } as unknown as Database;

      const repo = new TodoRepository(mockDb);
      const result = await repo.delete("test-uuid");

      expect(mockDelete).toHaveBeenCalledWith(todos);
      expect(mockWhere).toHaveBeenCalled();
      expect(mockReturning).toHaveBeenCalledWith({
        id: todos.id,
        listId: todos.listId,
        version: todos.version,
      });
      expect(result).toEqual({ id: "test-uuid", listId: sampleListId, version: 3 });
    });

    it("should return null when no row was deleted (0 rows returned)", async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });

      const mockDb = {
        delete: mockDelete,
      } as unknown as Database;

      const repo = new TodoRepository(mockDb);
      const result = await repo.delete("non-existent-uuid");

      expect(mockDelete).toHaveBeenCalledWith(todos);
      expect(result).toBeNull();
    });
  });

  describe("incrementVersion", () => {
    it("should increment task version atomically and return updated record", async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: "test-uuid", listId: sampleListId, version: 4 }]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

      const mockDb = {
        update: mockUpdate,
      } as unknown as Database;

      const repo = new TodoRepository(mockDb);
      const result = await repo.incrementVersion("test-uuid");

      expect(mockUpdate).toHaveBeenCalledWith(todos);
      expect(mockSet).toHaveBeenCalled();
      expect(mockReturning).toHaveBeenCalledWith({
        id: todos.id,
        listId: todos.listId,
        version: todos.version,
      });
      expect(result).toEqual({ id: "test-uuid", listId: sampleListId, version: 4 });
    });

    it("should return null when task does not exist", async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

      const mockDb = {
        update: mockUpdate,
      } as unknown as Database;

      const repo = new TodoRepository(mockDb);
      const result = await repo.incrementVersion("non-existent-uuid");

      expect(result).toBeNull();
    });
  });

  describe("incrementVersions", () => {
    it("should increment versions for multiple tasks and return array of updated records", async () => {
      const mockReturning = vi.fn().mockResolvedValue([
        { id: "task-1", listId: sampleListId, version: 2 },
        { id: "task-2", listId: sampleListId, version: 5 },
      ]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

      const mockDb = {
        update: mockUpdate,
      } as unknown as Database;

      const repo = new TodoRepository(mockDb);
      const result = await repo.incrementVersions(["task-1", "task-2"]);

      expect(mockUpdate).toHaveBeenCalledWith(todos);
      expect(mockReturning).toHaveBeenCalledWith({
        id: todos.id,
        listId: todos.listId,
        version: todos.version,
      });
      expect(result).toEqual([
        { id: "task-1", listId: sampleListId, version: 2 },
        { id: "task-2", listId: sampleListId, version: 5 },
      ]);
    });

    it("should return empty array when ids array is empty", async () => {
      const mockDb = {} as unknown as Database;
      const repo = new TodoRepository(mockDb);
      const result = await repo.incrementVersions([]);
      expect(result).toEqual([]);
    });
  });

  describe("create", () => {
    it("should execute INSERT with returning and return created record with status", async () => {
      const createdRecord = {
        id: "new-uuid",
        listId: sampleListId,
        title: "Test Task",
        description: null,
        status: "TODO" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([createdRecord]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      const mockDb = {
        insert: mockInsert,
      } as unknown as Database;

      const repo = new TodoRepository(mockDb);
      const result = await repo.create({
        listId: sampleListId,
        title: "Test Task",
      });

      expect(mockInsert).toHaveBeenCalledWith(todos);
      expect(mockValues).toHaveBeenCalledWith({
        listId: sampleListId,
        title: "Test Task",
        description: null,
        status: "TODO",
        priority: "MEDIUM",
        dueDate: null,
        recurrenceRuleId: null,
        occurrenceNumber: null,
      });
      expect(result).toEqual(createdRecord);
    });
  });

  describe("findAllByListId", () => {
    it("should query todos for specific listId ordered by createdAt descending", async () => {
      const records = [
        { id: "1", listId: sampleListId, title: "Task 1", createdAt: new Date() },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(records);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      const mockDb = {
        select: mockSelect,
      } as unknown as Database;

      const repo = new TodoRepository(mockDb);
      const result = await repo.findAllByListId(sampleListId);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith(todos);
      expect(mockWhere).toHaveBeenCalled();
      expect(result).toEqual(records.map((r) => ({ ...r, tags: [], attachmentCount: 0 })));
    });
  });

  describe("updateStatus", () => {
    it("should update status and return updated record", async () => {
      const updatedRecord = {
        id: "task-1",
        listId: sampleListId,
        title: "Task 1",
        status: "DONE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([updatedRecord]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

      const mockDb = {
        update: mockUpdate,
      } as unknown as Database;

      const repo = new TodoRepository(mockDb);
      const result = await repo.updateStatus("task-1", "DONE");

      expect(mockUpdate).toHaveBeenCalledWith(todos);
      expect(mockSet).toHaveBeenCalled();
      expect(result).toEqual(updatedRecord);
    });
  });
});
