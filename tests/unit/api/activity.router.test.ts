import { describe, it, expect, vi, beforeEach } from "vitest";
import { activityRouter } from "@/server/api/routers/activity.router";
import { activityService } from "@/server/services/activity.service";
import { NotFoundError } from "@/server/errors";

vi.mock("@/server/services/activity.service", () => ({
  activityService: {
    getActivityByList: vi.fn(),
  },
}));

describe("Activity tRPC Router", () => {
  const mockUser = {
    id: "user-1",
    email: "user1@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const createCaller = (user: any) =>
    activityRouter.createCaller({
      user,
      headers: new Headers(),
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return activity logs for an authorized list", async () => {
    const caller = createCaller(mockUser);
    const mockOutput = {
      items: [
        {
          id: "act-1",
          listId: "00000000-0000-4000-8000-000000000001",
          actorId: "user-1",
          actorEmail: "user1@example.com",
          action: "TODO_CREATED" as const,
          entityType: "TODO" as const,
          entityId: "todo-1",
          metadata: { title: "Buy Milk" },
          createdAt: new Date(),
        },
      ],
      nextCursor: null,
    };

    vi.mocked(activityService.getActivityByList).mockResolvedValue(mockOutput);

    const result = await caller.listByList({
      listId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result).toEqual(mockOutput);
    expect(activityService.getActivityByList).toHaveBeenCalledWith(
      {
        listId: "00000000-0000-4000-8000-000000000001",
        cursor: undefined,
        limit: 20,
      },
      "user-1"
    );
  });

  it("should reject unauthenticated caller", async () => {
    const caller = createCaller(null);
    await expect(
      caller.listByList({
        listId: "00000000-0000-4000-8000-000000000001",
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("should throw NOT_FOUND TRPCError if user has no access to the list", async () => {
    const caller = createCaller(mockUser);
    vi.mocked(activityService.getActivityByList).mockRejectedValue(
      new NotFoundError("List not found")
    );

    await expect(
      caller.listByList({
        listId: "00000000-0000-4000-8000-000000000001",
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
