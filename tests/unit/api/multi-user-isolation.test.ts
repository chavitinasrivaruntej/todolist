import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "@/server/api/root";
import { todoListService } from "@/server/services/todo-list.service";
import { todoService } from "@/server/services/todo.service";
import { NotFoundError } from "@/server/errors";
import type { User } from "@supabase/supabase-js";

describe("Multi-Tenant Cross-User Isolation & Security Audit", () => {
  const userAlpha: User = {
    id: "user-alpha-1111",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const userBeta: User = {
    id: "user-beta-2222",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const callerAlpha = appRouter.createCaller({ headers: undefined, user: userAlpha });
  const callerBeta = appRouter.createCaller({ headers: undefined, user: userBeta });
  const unauthedCaller = appRouter.createCaller({ headers: undefined, user: null });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Unauthenticated Access Rejection (Zero Trust)", () => {
    const validUuid = "00000000-0000-4000-8000-000000000001";

    it("should reject todoList.list without session", async () => {
      await expect(unauthedCaller.todoList.list()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("should reject todoList.create without session", async () => {
      await expect(unauthedCaller.todoList.create({ name: "Work" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("should reject todoList.rename without session", async () => {
      await expect(unauthedCaller.todoList.rename({ id: validUuid, name: "New Name" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("should reject todoList.delete without session", async () => {
      await expect(unauthedCaller.todoList.delete({ id: validUuid })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("should reject todo.list without session", async () => {
      await expect(unauthedCaller.todo.list({ listId: validUuid })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("should reject todo.create without session", async () => {
      await expect(unauthedCaller.todo.create({ listId: validUuid, title: "Task" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("should reject todo.updateStatus without session", async () => {
      await expect(unauthedCaller.todo.updateStatus({ id: validUuid, status: "DONE" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("should reject todo.delete without session", async () => {
      await expect(unauthedCaller.todo.delete({ id: validUuid })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("2. Cross-Tenant List Isolation", () => {
    it("should pass the caller's verified userId to todoListService and isolate lists", async () => {
      vi.spyOn(todoListService, "getLists").mockImplementation(async (userId) => {
        if (userId === userAlpha.id) {
          return [
            {
              id: "list-alpha",
              userId: userAlpha.id,
              name: "Alpha's Secret List",
              createdAt: new Date(),
              updatedAt: new Date(),
              taskCount: 1,
              effectiveRole: "OWNER" as const,
            },
          ];
        }
        return [
          {
            id: "list-beta",
            userId: userBeta.id,
            name: "Beta's List",
            createdAt: new Date(),
            updatedAt: new Date(),
            taskCount: 0,
            effectiveRole: "OWNER" as const,
          },
        ];
      });

      const alphaLists = await callerAlpha.todoList.list();
      expect(alphaLists[0]?.name).toBe("Alpha's Secret List");

      const betaLists = await callerBeta.todoList.list();
      expect(betaLists[0]?.name).toBe("Beta's List");

      expect(todoListService.getLists).toHaveBeenCalledWith(userAlpha.id);
      expect(todoListService.getLists).toHaveBeenCalledWith(userBeta.id);
    });

    it("should return NOT_FOUND when User Alpha attempts to rename User Beta's list", async () => {
      const betaListId = "00000000-0000-4000-8000-000000000088";
      vi.spyOn(todoListService, "renameList").mockImplementation(async (input, userId) => {
        if (input.id === betaListId && userId === userAlpha.id) {
          throw new NotFoundError(`Todo list with ID ${betaListId} was not found.`);
        }
        return {
          id: input.id,
          userId,
          name: input.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      await expect(
        callerAlpha.todoList.rename({ id: betaListId, name: "Alpha Hijack" })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("should return NOT_FOUND when User Alpha attempts to delete User Beta's list", async () => {
      const betaListId = "00000000-0000-4000-8000-000000000088";
      vi.spyOn(todoListService, "deleteList").mockImplementation(async (input, userId) => {
        if (input.id === betaListId && userId === userAlpha.id) {
          throw new NotFoundError(`Todo list with ID ${betaListId} was not found.`);
        }
        return { success: true, id: input.id };
      });

      await expect(
        callerAlpha.todoList.delete({ id: betaListId })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("3. Cross-Tenant Task Isolation", () => {
    const betaListId = "00000000-0000-4000-8000-000000000099";
    const betaTaskId = "00000000-0000-4000-8000-000000000077";

    it("should return NOT_FOUND when User Alpha attempts to access User Beta's list tasks", async () => {
      vi.spyOn(todoService, "getTodosByList").mockImplementation(async (input, userId) => {
        if (input.listId === betaListId && userId === userAlpha.id) {
          throw new NotFoundError(`Todo list with ID ${betaListId} was not found.`);
        }
        return [];
      });

      await expect(
        callerAlpha.todo.list({ listId: betaListId })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("should return NOT_FOUND when User Alpha attempts to create task inside User Beta's list", async () => {
      vi.spyOn(todoService, "createTodo").mockImplementation(async (input, userId) => {
        if (input.listId === betaListId && userId === userAlpha.id) {
          throw new NotFoundError(`Todo list with ID ${betaListId} was not found.`);
        }
        return {
          id: "new-task-id",
          listId: input.listId,
          title: input.title,
          description: input.description ?? null,
          status: "TODO",
          priority: "MEDIUM" as const,
          dueDate: null,
          recurrenceRuleId: null,
          occurrenceNumber: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        };
      });

      await expect(
        callerAlpha.todo.create({ listId: betaListId, title: "Malicious Task" })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("should return NOT_FOUND when User Alpha attempts to update status of User Beta's task", async () => {
      vi.spyOn(todoService, "updateStatus").mockImplementation(async (input, userId) => {
        if (input.id === betaTaskId && userId === userAlpha.id) {
          throw new NotFoundError("Todo was not found.");
        }
        return {
          id: input.id,
          listId: betaListId,
          title: "Beta Task",
          description: null,
          status: input.status,
          priority: "MEDIUM" as const,
          dueDate: null,
          recurrenceRuleId: null,
          occurrenceNumber: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
        };
      });

      await expect(
        callerAlpha.todo.updateStatus({
          id: betaTaskId,
          status: "DONE",
        })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("should return NOT_FOUND when User Alpha attempts to delete User Beta's task", async () => {
      vi.spyOn(todoService, "deleteTodo").mockImplementation(async (input, userId) => {
        if (input.id === betaTaskId && userId === userAlpha.id) {
          throw new NotFoundError("Todo was not found.");
        }
        return { success: true, id: input.id };
      });

      await expect(
        callerAlpha.todo.delete({
          id: betaTaskId,
        })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("4. Identity Spoofing Protection", () => {
    it("should ignore any client-supplied userId and always bind to session ctx.user.id", async () => {
      const mockCreateList = vi.spyOn(todoListService, "createList").mockResolvedValue({
        id: "alpha-list-id",
        userId: userAlpha.id,
        name: "Legit List",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Even if client injects userId into the mutation input:
      // @ts-expect-error testing spoofing injection
      await callerAlpha.todoList.create({ name: "Legit List", userId: userBeta.id });

      // Verifies that the service was called with User Alpha's ID, NOT User Beta's ID
      expect(mockCreateList).toHaveBeenCalledWith(
        { name: "Legit List" },
        userAlpha.id
      );
      expect(mockCreateList).not.toHaveBeenCalledWith(expect.anything(), userBeta.id);
    });
  });

  describe("5. Positive Authorization Scenarios", () => {
    const alphaListId = "00000000-0000-4000-8000-000000000011";
    const alphaTaskId = "00000000-0000-4000-8000-000000000022";

    it("should allow User Alpha to manage their own list and tasks", async () => {
      vi.spyOn(todoListService, "createList").mockResolvedValue({
        id: alphaListId,
        userId: userAlpha.id,
        name: "Alpha List",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.spyOn(todoService, "createTodo").mockResolvedValue({
        id: alphaTaskId,
        listId: alphaListId,
        title: "Alpha Task",
        description: "Valid task",
        status: "TODO",
        priority: "MEDIUM" as const,
        dueDate: null,
        recurrenceRuleId: null,
        occurrenceNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      });

      vi.spyOn(todoService, "updateStatus").mockResolvedValue({
        id: alphaTaskId,
        listId: alphaListId,
        title: "Alpha Task",
        description: "Valid task",
        status: "DONE",
        priority: "MEDIUM" as const,
        dueDate: null,
        recurrenceRuleId: null,
        occurrenceNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      });

      vi.spyOn(todoService, "deleteTodo").mockResolvedValue({
        success: true,
        id: alphaTaskId,
      });

      const list = await callerAlpha.todoList.create({ name: "Alpha List" });
      expect(list.id).toBe(alphaListId);

      const task = await callerAlpha.todo.create({ listId: alphaListId, title: "Alpha Task" });
      expect(task.id).toBe(alphaTaskId);

      const updatedTask = await callerAlpha.todo.updateStatus({ id: alphaTaskId, status: "DONE" });
      expect(updatedTask.status).toBe("DONE");

      const delResult = await callerAlpha.todo.delete({ id: alphaTaskId });
      expect(delResult.success).toBe(true);
    });
  });
});
