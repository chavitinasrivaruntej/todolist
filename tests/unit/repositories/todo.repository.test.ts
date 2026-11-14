import { describe, it, expect, vi } from "vitest";
import { TodoRepository } from "@/server/repositories/todo.repository";
import { type Database } from "@/db";
import { todos } from "@/db/schema/todos";

describe("TodoRepository", () => {
  describe("delete", () => {
    it("should execute DELETE with RETURNING and return true when row was deleted", async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: "test-uuid" }]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });

      const mockDb = {
        delete: mockDelete,
      } as unknown as Database;

      const repo = new TodoRepository(mockDb);
      const result = await repo.delete("test-uuid");

      expect(mockDelete).toHaveBeenCalledWith(todos);
      expect(mockWhere).toHaveBeenCalled();
      expect(mockReturning).toHaveBeenCalledWith({ id: todos.id });
      expect(result).toBe(true);
    });

    it("should return false when no row was deleted (0 rows returned)", async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });

      const mockDb = {
        delete: mockDelete,
      } as unknown as Database;

      const repo = new TodoRepository(mockDb);
      const result = await repo.delete("non-existent-uuid");

      expect(mockDelete).toHaveBeenCalledWith(todos);
      expect(result).toBe(false);
    });
  });

  describe("create", () => {
    it("should execute INSERT with returning and return created record", async () => {
      const createdRecord = {
        id: "new-uuid",
        title: "Test Task",
        description: null,
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
      const result = await repo.create({ title: "Test Task" });

      expect(mockInsert).toHaveBeenCalledWith(todos);
      expect(mockValues).toHaveBeenCalledWith({
        title: "Test Task",
        description: null,
      });
      expect(result).toEqual(createdRecord);
    });
  });

  describe("findAll", () => {
    it("should query todos ordered by createdAt descending", async () => {
      const records = [
        { id: "1", title: "Task 1", createdAt: new Date() },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(records);
      const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      const mockDb = {
        select: mockSelect,
      } as unknown as Database;

      const repo = new TodoRepository(mockDb);
      const result = await repo.findAll();

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith(todos);
      expect(result).toEqual(records);
    });
  });
});
