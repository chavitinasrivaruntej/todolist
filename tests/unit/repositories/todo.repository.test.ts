import { describe, it, expect, vi } from "vitest";
import { TodoRepository } from "@/server/repositories/todo.repository";
import { type Database } from "@/db";

describe("TodoRepository Contract", () => {
  it("should be instantiable with a custom database client", () => {
    const mockDb = {} as unknown as Database;
    const repo = new TodoRepository(mockDb);
    expect(repo).toBeInstanceOf(TodoRepository);
  });

  it("should define findAll, findById, create, and delete operations", () => {
    const mockDb = {} as unknown as Database;
    const repo = new TodoRepository(mockDb);

    expect(typeof repo.findAll).toBe("function");
    expect(typeof repo.findById).toBe("function");
    expect(typeof repo.create).toBe("function");
    expect(typeof repo.delete).toBe("function");
  });
});
