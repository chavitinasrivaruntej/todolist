import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "@/server/api/root";
import { todoListService } from "@/server/services/todo-list.service";
import { NotFoundError, ValidationError } from "@/server/errors";
import { TRPCError } from "@trpc/server";
import type { User } from "@supabase/supabase-js";

describe("tRPC API: TodoList Router", () => {
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

  const sampleList = {
    id: "123e4567-e89b-42d3-a456-426614174001",
    userId: mockUser.id,
    name: "Projects",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    taskCount: 2,
    effectiveRole: "OWNER" as const,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("authentication guard", () => {
    it("should reject unauthenticated request with UNAUTHORIZED", async () => {
      const unauthedCaller = createCaller(null);
      await expect(unauthedCaller.todoList.list()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("todoList.list", () => {
    it("should return all lists with task counts from service for the authenticated user", async () => {
      vi.spyOn(todoListService, "getLists").mockResolvedValue([sampleList]);

      const caller = createCaller();
      const result = await caller.todoList.list();

      expect(todoListService.getLists).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual([sampleList]);
    });
  });

  describe("todoList.create", () => {
    it("should validate input schema and create list scoped to authenticated user", async () => {
      vi.spyOn(todoListService, "createList").mockResolvedValue(sampleList);

      const caller = createCaller();
      const result = await caller.todoList.create({ name: "Projects" });

      expect(todoListService.createList).toHaveBeenCalledWith(
        { name: "Projects" },
        mockUser.id
      );
      expect(result).toEqual(sampleList);
    });

    it("should reject empty name with BAD_REQUEST", async () => {
      const caller = createCaller();

      await expect(
        caller.todoList.create({ name: "" })
      ).rejects.toThrowError(TRPCError);
    });
  });

  describe("todoList.rename", () => {
    it("should rename an existing list scoped to authenticated user", async () => {
      const renamed = { ...sampleList, name: "College Work" };
      vi.spyOn(todoListService, "renameList").mockResolvedValue(renamed);

      const caller = createCaller();
      const result = await caller.todoList.rename({
        id: sampleList.id,
        name: "College Work",
      });

      expect(todoListService.renameList).toHaveBeenCalledWith(
        {
          id: sampleList.id,
          name: "College Work",
        },
        mockUser.id
      );
      expect(result).toEqual(renamed);
    });
  });

  describe("todoList.delete", () => {
    it("should delete list and return success payload", async () => {
      vi.spyOn(todoListService, "deleteList").mockResolvedValue({
        success: true,
        id: sampleList.id,
      });

      const caller = createCaller();
      const result = await caller.todoList.delete({
        id: sampleList.id,
        force: false,
      });

      expect(todoListService.deleteList).toHaveBeenCalledWith(
        {
          id: sampleList.id,
          force: false,
        },
        mockUser.id
      );
      expect(result).toEqual({ success: true, id: sampleList.id });
    });

    it("should translate ValidationError into BAD_REQUEST when list has tasks and force=false", async () => {
      vi.spyOn(todoListService, "deleteList").mockRejectedValue(
        new ValidationError("Cannot delete list because it contains tasks.")
      );

      const caller = createCaller();

      await expect(
        caller.todoList.delete({
          id: sampleList.id,
          force: false,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Cannot delete list because it contains tasks.",
      });
    });

    it("should translate NotFoundError into NOT_FOUND", async () => {
      vi.spyOn(todoListService, "deleteList").mockRejectedValue(
        new NotFoundError(`Todo list not found`)
      );

      const caller = createCaller();

      await expect(
        caller.todoList.delete({
          id: sampleList.id,
          force: false,
        })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });
});
