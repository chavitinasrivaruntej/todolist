import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "@/server/api/root";
import { todoListService } from "@/server/services/todo-list.service";
import { todoService } from "@/server/services/todo.service";
import { NotFoundError } from "@/server/errors";
import type { User } from "@supabase/supabase-js";

describe("Multi-Tenant Cross-User Isolation", () => {
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

  beforeEach(() => {
    vi.restoreAllMocks();
  });

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

  it("should return NOT_FOUND when User Alpha attempts to access User Beta's list tasks", async () => {
    const betaListId = "00000000-0000-4000-8000-000000000099";
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

  it("should return NOT_FOUND when User Alpha attempts to update status of User Beta's task", async () => {
    vi.spyOn(todoService, "updateStatus").mockImplementation(async (input, userId) => {
      if (userId === userAlpha.id) {
        throw new NotFoundError("Todo was not found.");
      }
      return {
        id: input.id,
        listId: "list-id",
        title: "Beta Task",
        description: null,
        status: input.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    await expect(
      callerAlpha.todo.updateStatus({
        id: "00000000-0000-4000-8000-000000000099",
        status: "DONE",
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("should return NOT_FOUND when User Alpha attempts to delete User Beta's task", async () => {
    vi.spyOn(todoService, "deleteTodo").mockImplementation(async (input, userId) => {
      if (userId === userAlpha.id) {
        throw new NotFoundError("Todo was not found.");
      }
      return { success: true, id: input.id };
    });

    await expect(
      callerAlpha.todo.delete({
        id: "00000000-0000-4000-8000-000000000099",
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
