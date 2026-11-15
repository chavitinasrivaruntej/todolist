import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "@/server/api/root";
import { todoService } from "@/server/services/todo.service";
import { NotFoundError, ValidationError } from "@/server/errors";
import { TRPCError } from "@trpc/server";
import type { User } from "@supabase/supabase-js";

describe("tRPC API: Todo Router", () => {
  const mockUser: User = {
    id: "user-1234-abcd",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const createCaller = (user: User | null = mockUser) =>
    appRouter.createCaller({
      headers: undefined,
      user,
    });

  const sampleListId = "123e4567-e89b-42d3-a456-426614174001";
  const sampleTodo = {
    id: "123e4567-e89b-42d3-a456-426614174000",
    listId: sampleListId,
    title: "Integration Task",
    description: "Testing tRPC procedures",
    status: "TODO" as const,
    priority: "MEDIUM" as const,
    dueDate: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("authentication guard", () => {
    it("should reject unauthenticated calls with UNAUTHORIZED", async () => {
      const unauthedCaller = createCaller(null);
      await expect(
        unauthedCaller.todo.list({ listId: sampleListId })
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("todo.list", () => {
    it("should return the list of todos for a specific listId from service", async () => {
      vi.spyOn(todoService, "getTodosByList").mockResolvedValue([sampleTodo]);

      const caller = createCaller();
      const result = await caller.todo.list({ listId: sampleListId });

      expect(todoService.getTodosByList).toHaveBeenCalledWith(
        expect.objectContaining({
          listId: sampleListId,
          dueFilter: "ALL",
          sortBy: "created",
          sortDirection: "desc",
        }),
        mockUser.id
      );
      expect(result).toEqual([sampleTodo]);
    });

    it("regression: should accept migrated default list ID without Zod validation failure", async () => {
      const defaultListId = "00000000-0000-4000-8000-000000000001";
      vi.spyOn(todoService, "getTodosByList").mockResolvedValue([]);

      const caller = createCaller();
      const result = await caller.todo.list({ listId: defaultListId });

      expect(todoService.getTodosByList).toHaveBeenCalledWith(
        expect.objectContaining({
          listId: defaultListId,
        }),
        mockUser.id
      );
      expect(result).toEqual([]);
    });

    it("should reject non-UUID listId with BAD_REQUEST", async () => {
      const caller = createCaller();

      await expect(
        caller.todo.list({ listId: "invalid-uuid" })
      ).rejects.toThrowError(TRPCError);
    });
  });

  describe("todo.create", () => {
    it("should validate input schema and create a todo scoped to user", async () => {
      vi.spyOn(todoService, "createTodo").mockResolvedValue(sampleTodo);

      const caller = createCaller();
      const result = await caller.todo.create({
        listId: sampleListId,
        title: "Integration Task",
        description: "Testing tRPC procedures",
        status: "TODO",
      });

      expect(todoService.createTodo).toHaveBeenCalledWith(
        expect.objectContaining({
          listId: sampleListId,
          title: "Integration Task",
          description: "Testing tRPC procedures",
          status: "TODO",
          priority: "MEDIUM",
        }),
        mockUser.id
      );
      expect(result).toEqual(sampleTodo);
    });

    it("should reject missing listId with BAD_REQUEST", async () => {
      const caller = createCaller();

      await expect(
        // @ts-expect-error testing missing field validation
        caller.todo.create({
          title: "Missing List ID",
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
          listId: sampleListId,
          title: "Valid Title",
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Domain validation failed",
      });
    });
  });

  describe("todo.updateStatus", () => {
    it("should update status and return updated todo", async () => {
      const updatedTodo = { ...sampleTodo, status: "IN_PROGRESS" as const };
      vi.spyOn(todoService, "updateStatus").mockResolvedValue(updatedTodo);

      const caller = createCaller();
      const result = await caller.todo.updateStatus({
        id: sampleTodo.id,
        status: "IN_PROGRESS",
      });

      expect(todoService.updateStatus).toHaveBeenCalledWith(
        {
          id: sampleTodo.id,
          status: "IN_PROGRESS",
        },
        mockUser.id
      );
      expect(result).toEqual(updatedTodo);
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

      expect(todoService.deleteTodo).toHaveBeenCalledWith(
        {
          id: sampleTodo.id,
        },
        mockUser.id
      );
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
