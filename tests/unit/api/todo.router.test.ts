import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "@/server/api/root";
import { todoService } from "@/server/services/todo.service";
import { NotFoundError, ValidationError } from "@/server/errors";
import { TRPCError } from "@trpc/server";

describe("tRPC API: Todo Router", () => {
  const createCaller = () =>
    appRouter.createCaller({
      headers: undefined,
    });

  const sampleTodo = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    title: "Integration Task",
    description: "Testing tRPC procedures",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("todo.list", () => {
    it("should return the list of todos from service", async () => {
      vi.spyOn(todoService, "getTodos").mockResolvedValue([sampleTodo]);

      const caller = createCaller();
      const result = await caller.todo.list();

      expect(todoService.getTodos).toHaveBeenCalledTimes(1);
      expect(result).toEqual([sampleTodo]);
    });
  });

  describe("todo.create", () => {
    it("should validate input schema and create a todo", async () => {
      vi.spyOn(todoService, "createTodo").mockResolvedValue(sampleTodo);

      const caller = createCaller();
      const result = await caller.todo.create({
        title: "Integration Task",
        description: "Testing tRPC procedures",
      });

      expect(todoService.createTodo).toHaveBeenCalledWith({
        title: "Integration Task",
        description: "Testing tRPC procedures",
      });
      expect(result).toEqual(sampleTodo);
    });

    it("should reject invalid input schema with BAD_REQUEST", async () => {
      const caller = createCaller();

      await expect(
        caller.todo.create({
          title: "",
        })
      ).rejects.toThrowError(TRPCError);
    });

    it("should translate domain ValidationError to tRPC BAD_REQUEST", async () => {
      vi.spyOn(todoService, "createTodo").mockRejectedValue(
        new ValidationError("Domain validation failed")
      );

      const caller = createCaller();

      await expect(
        caller.todo.create({
          title: "Valid Title",
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Domain validation failed",
      });
    });
  });

  describe("todo.delete", () => {
    it("should delete todo and return success payload", async () => {
      vi.spyOn(todoService, "deleteTodo").mockResolvedValue({
        success: true,
        id: sampleTodo.id,
      });

      const caller = createCaller();
      const result = await caller.todo.delete({
        id: sampleTodo.id,
      });

      expect(todoService.deleteTodo).toHaveBeenCalledWith({
        id: sampleTodo.id,
      });
      expect(result).toEqual({
        success: true,
        id: sampleTodo.id,
      });
    });

    it("should translate domain NotFoundError into tRPC NOT_FOUND code", async () => {
      vi.spyOn(todoService, "deleteTodo").mockRejectedValue(
        new NotFoundError(`Todo with ID ${sampleTodo.id} was not found.`)
      );

      const caller = createCaller();

      await expect(
        caller.todo.delete({
          id: sampleTodo.id,
        })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: `Todo with ID ${sampleTodo.id} was not found.`,
      });
    });

    it("should reject non-UUID input with tRPC BAD_REQUEST", async () => {
      const caller = createCaller();

      await expect(
        caller.todo.delete({
          id: "not-a-uuid",
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });
  });
});

