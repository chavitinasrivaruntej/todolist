import { describe, it, expect, vi } from "vitest";
import { appRouter } from "@/server/api/root";
import { listPermissionService } from "@/server/services/list-permission.service";
import { NotFoundError } from "@/server/errors";
import { TRPCError } from "@trpc/server";
import type { User } from "@supabase/supabase-js";

describe("tRPC API: Realtime Router", () => {
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

  it("should authorize an OWNER or collaborator to subscribe to the list private channel", async () => {
    vi.spyOn(listPermissionService, "requireCanReadList").mockResolvedValue("OWNER");

    const caller = createCaller();
    const result = await caller.realtime.authorizeChannel({ listId: sampleListId });

    expect(result).toEqual({
      authorized: true,
      listId: sampleListId,
      topic: `realtime:list:${sampleListId}`,
      role: "OWNER",
      userId: mockUser.id,
    });
  });

  it("should authorize a VIEWER to receive realtime updates", async () => {
    vi.spyOn(listPermissionService, "requireCanReadList").mockResolvedValue("VIEWER");

    const caller = createCaller();
    const result = await caller.realtime.authorizeChannel({ listId: sampleListId });

    expect(result.authorized).toBe(true);
    expect(result.role).toBe("VIEWER");
  });

  it("should translate NotFoundError into NOT_FOUND for unauthorized non-members", async () => {
    vi.spyOn(listPermissionService, "requireCanReadList").mockRejectedValue(
      new NotFoundError(`Todo list with ID ${sampleListId} was not found.`)
    );

    const caller = createCaller();
    await expect(
      caller.realtime.authorizeChannel({ listId: sampleListId })
    ).rejects.toThrowError(TRPCError);
  });
});
