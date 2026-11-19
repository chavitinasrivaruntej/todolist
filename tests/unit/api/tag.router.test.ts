import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "@/server/api/root";
import { tagService } from "@/server/services/tag.service";
import { NotFoundError, ValidationError } from "@/server/errors";
import type { User } from "@supabase/supabase-js";
import { type Tag } from "@/db/schema/tags";

describe("tRPC API: Tag Router", () => {
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
  const sampleTag: Tag = {
    id: "123e4567-e89b-42d3-a456-426614174999",
    listId: sampleListId,
    name: "Urgent Fix",
    color: "red",
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
        unauthedCaller.tag.listByList({ listId: sampleListId })
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("tag.listByList", () => {
    it("should return tags for the requested list", async () => {
      vi.spyOn(tagService, "getTagsByList").mockResolvedValue([sampleTag]);

      const caller = createCaller();
      const result = await caller.tag.listByList({ listId: sampleListId });

      expect(tagService.getTagsByList).toHaveBeenCalledWith(
        sampleListId,
        mockUser.id
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Urgent Fix");
    });
  });

  describe("tag.create", () => {
    it("should call tagService.createTag and return new tag", async () => {
      vi.spyOn(tagService, "createTag").mockResolvedValue(sampleTag);

      const caller = createCaller();
      const result = await caller.tag.create({
        listId: sampleListId,
        name: "Urgent Fix",
        color: "red",
      });

      expect(tagService.createTag).toHaveBeenCalledWith(
        {
          listId: sampleListId,
          name: "Urgent Fix",
          color: "red",
        },
        mockUser.id
      );
      expect(result.id).toBe(sampleTag.id);
    });

    it("should transform domain ValidationError to BAD_REQUEST", async () => {
      vi.spyOn(tagService, "createTag").mockRejectedValue(
        new ValidationError("A tag with this name already exists in this list.")
      );

      const caller = createCaller();
      await expect(
        caller.tag.create({
          listId: sampleListId,
          name: "Urgent Fix",
          color: "red",
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "A tag with this name already exists in this list.",
      });
    });
  });

  describe("tag.update", () => {
    it("should call tagService.updateTag and return updated tag", async () => {
      const updated = { ...sampleTag, name: "Normal Fix" };
      vi.spyOn(tagService, "updateTag").mockResolvedValue(updated);

      const caller = createCaller();
      const result = await caller.tag.update({
        id: sampleTag.id,
        name: "Normal Fix",
      });

      expect(tagService.updateTag).toHaveBeenCalledWith(
        {
          id: sampleTag.id,
          name: "Normal Fix",
        },
        mockUser.id
      );
      expect(result.name).toBe("Normal Fix");
    });

    it("should transform domain NotFoundError to NOT_FOUND", async () => {
      vi.spyOn(tagService, "updateTag").mockRejectedValue(
        new NotFoundError("Tag not found")
      );

      const caller = createCaller();
      await expect(
        caller.tag.update({
          id: sampleTag.id,
          name: "Any",
        })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("tag.delete", () => {
    it("should call tagService.deleteTag and return success", async () => {
      vi.spyOn(tagService, "deleteTag").mockResolvedValue({
        success: true,
        id: sampleTag.id,
      });

      const caller = createCaller();
      const result = await caller.tag.delete({ id: sampleTag.id });

      expect(tagService.deleteTag).toHaveBeenCalledWith(
        sampleTag.id,
        mockUser.id
      );
      expect(result).toEqual({ success: true, id: sampleTag.id });
    });
  });
});
