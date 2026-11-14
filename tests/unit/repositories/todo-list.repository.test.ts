import { describe, it, expect, vi } from "vitest";
import { TodoListRepository } from "@/server/repositories/todo-list.repository";
import { type Database } from "@/db";
import { todoLists } from "@/db/schema/lists";

describe("TodoListRepository", () => {
  describe("create", () => {
    it("should insert a new todo list and return the record", async () => {
      const createdRecord = {
        id: "list-1",
        name: "Academics",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([createdRecord]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      const mockDb = {
        insert: mockInsert,
      } as unknown as Database;

      const repo = new TodoListRepository(mockDb);
      const result = await repo.create({ name: "Academics" });

      expect(mockInsert).toHaveBeenCalledWith(todoLists);
      expect(mockValues).toHaveBeenCalledWith({ name: "Academics" });
      expect(result).toEqual(createdRecord);
    });
  });

  describe("updateName", () => {
    it("should update list name and return updated record", async () => {
      const updatedRecord = {
        id: "list-1",
        name: "College Work",
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

      const repo = new TodoListRepository(mockDb);
      const result = await repo.updateName("list-1", "College Work");

      expect(mockUpdate).toHaveBeenCalledWith(todoLists);
      expect(result).toEqual(updatedRecord);
    });
  });

  describe("delete", () => {
    it("should delete list by ID and return true when deleted", async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: "list-1" }]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });

      const mockDb = {
        delete: mockDelete,
      } as unknown as Database;

      const repo = new TodoListRepository(mockDb);
      const result = await repo.delete("list-1");

      expect(mockDelete).toHaveBeenCalledWith(todoLists);
      expect(result).toBe(true);
    });

    it("should return false when list ID does not exist", async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });

      const mockDb = {
        delete: mockDelete,
      } as unknown as Database;

      const repo = new TodoListRepository(mockDb);
      const result = await repo.delete("missing-id");

      expect(result).toBe(false);
    });
  });

  describe("countTasksByListId", () => {
    it("should return task count for given listId", async () => {
      const mockWhere = vi.fn().mockResolvedValue([{ taskCount: "4" }]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      const mockDb = {
        select: mockSelect,
      } as unknown as Database;

      const repo = new TodoListRepository(mockDb);
      const count = await repo.countTasksByListId("list-1");

      expect(mockSelect).toHaveBeenCalled();
      expect(count).toBe(4);
    });
  });
});

