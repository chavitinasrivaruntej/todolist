import { describe, it, expect, vi, beforeEach } from "vitest";
import { TagService } from "@/server/services/tag.service";
import { type ITagRepository } from "@/server/repositories/tag.repository";
import { ListPermissionService } from "@/server/services/list-permission.service";
import { ActivityService } from "@/server/services/activity.service";
import { type Tag } from "@/db/schema/tags";
import { NotFoundError, ValidationError } from "@/server/errors";

describe("TagService", () => {
  let mockTagRepository: ITagRepository;
  let mockPermissionService: ListPermissionService;
  let mockActivityService: ActivityService;
  let service: TagService;

  const testUserId = "user-test-uuid";
  const mockDate = new Date("2026-01-01T00:00:00.000Z");
  const sampleListId = "123e4567-e89b-42d3-a456-426614174001";
  const sampleTag: Tag = {
    id: "123e4567-e89b-42d3-a456-426614174999",
    listId: sampleListId,
    name: "Frontend",
    color: "blue",
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  beforeEach(() => {
    mockTagRepository = {
      findAllByListId: vi.fn(),
      findById: vi.fn().mockResolvedValue(sampleTag),
      findByNameAndListId: vi.fn().mockResolvedValue(null),
      findByIdsAndListId: vi.fn().mockResolvedValue([sampleTag]),
      findTagsForTodo: vi.fn().mockResolvedValue([sampleTag]),
      findTagsForTodos: vi.fn().mockResolvedValue(new Map()),
      create: vi.fn().mockResolvedValue(sampleTag),
      update: vi.fn().mockResolvedValue(sampleTag),
      delete: vi.fn().mockResolvedValue(true),
      assignTagsToTodo: vi.fn(),
      syncTagsForTodo: vi.fn(),
    };

    mockPermissionService = {
      getUserRole: vi.fn().mockResolvedValue("OWNER"),
      requireOwner: vi.fn().mockResolvedValue(undefined),
      requireCanMutateTodos: vi.fn().mockResolvedValue("OWNER"),
      requireCanReadList: vi.fn().mockResolvedValue("OWNER"),
    } as unknown as ListPermissionService;

    mockActivityService = {
      logActivity: vi.fn().mockResolvedValue({}),
    } as unknown as ActivityService;

    service = new TagService(
      mockTagRepository,
      mockPermissionService,
      mockActivityService,
      undefined as any
    );
  });

  describe("getTagsByList", () => {
    it("should return list tags when user has read access", async () => {
      vi.mocked(mockTagRepository.findAllByListId).mockResolvedValue([sampleTag]);

      const result = await service.getTagsByList(sampleListId, testUserId);

      expect(mockPermissionService.requireCanReadList).toHaveBeenCalledWith(testUserId, sampleListId);
      expect(mockTagRepository.findAllByListId).toHaveBeenCalledWith(sampleListId);
      expect(result).toEqual([sampleTag]);
    });

    it("should propagate error when user lacks read permission", async () => {
      vi.mocked(mockPermissionService.requireCanReadList).mockRejectedValue(
        new NotFoundError("List not found")
      );

      await expect(
        service.getTagsByList(sampleListId, testUserId)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("createTag", () => {
    it("should create a tag and log activity when user has mutate permission", async () => {
      const result = await service.createTag(
        { listId: sampleListId, name: "Backend", color: "emerald" },
        testUserId
      );

      expect(mockPermissionService.requireCanMutateTodos).toHaveBeenCalledWith(testUserId, sampleListId);
      expect(mockTagRepository.findByNameAndListId).toHaveBeenCalledWith("Backend", sampleListId);
      expect(mockTagRepository.create).toHaveBeenCalledWith(
        {
          listId: sampleListId,
          name: "Backend",
          color: "emerald",
        },
        undefined
      );
      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TAG_CREATED",
          entityType: "TAG",
        }),
        undefined
      );
      expect(result).toEqual(sampleTag);
    });

    it("should reject tag creation if name is empty or solely whitespace", async () => {
      await expect(
        service.createTag({ listId: sampleListId, name: "   ", color: "blue" }, testUserId)
      ).rejects.toThrow(ValidationError);

      expect(mockTagRepository.create).not.toHaveBeenCalled();
    });

    it("should reject duplicate tag name within the same list (case-insensitive)", async () => {
      vi.mocked(mockTagRepository.findByNameAndListId).mockResolvedValue(sampleTag);

      await expect(
        service.createTag({ listId: sampleListId, name: "frontend", color: "red" }, testUserId)
      ).rejects.toThrow(ValidationError);

      expect(mockTagRepository.create).not.toHaveBeenCalled();
    });

    it("should block Viewers from creating tags", async () => {
      vi.mocked(mockPermissionService.requireCanMutateTodos).mockRejectedValue(
        new ValidationError("Viewers have read-only access and cannot modify tasks.")
      );

      await expect(
        service.createTag({ listId: sampleListId, name: "Docs", color: "purple" }, testUserId)
      ).rejects.toThrow(ValidationError);

      expect(mockTagRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("updateTag", () => {
    it("should update tag name and color, and log TAG_UPDATED activity", async () => {
      const updatedTag = { ...sampleTag, name: "UI/UX", color: "pink" as const };
      vi.mocked(mockTagRepository.update).mockResolvedValue(updatedTag);

      const result = await service.updateTag(
        { id: sampleTag.id, name: "UI/UX", color: "pink" },
        testUserId
      );

      expect(mockTagRepository.findById).toHaveBeenCalledWith(sampleTag.id);
      expect(mockPermissionService.requireCanMutateTodos).toHaveBeenCalledWith(testUserId, sampleListId);
      expect(mockTagRepository.update).toHaveBeenCalledWith(
        sampleTag.id,
        {
          name: "UI/UX",
          color: "pink",
        },
        undefined
      );
      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TAG_UPDATED",
          entityType: "TAG",
        }),
        undefined
      );
      expect(result).toEqual(updatedTag);
    });

    it("should suppress no-op updates when name and color are unchanged", async () => {
      const result = await service.updateTag(
        { id: sampleTag.id, name: sampleTag.name, color: sampleTag.color as any },
        testUserId
      );

      expect(mockTagRepository.update).not.toHaveBeenCalled();
      expect(mockActivityService.logActivity).not.toHaveBeenCalled();
      expect(result).toEqual(sampleTag);
    });

    it("should prevent updating tag to an already existing name in the same list", async () => {
      const otherTag = { ...sampleTag, id: "other-id", name: "ExistingTag" };
      vi.mocked(mockTagRepository.findByNameAndListId).mockResolvedValue(otherTag);

      await expect(
        service.updateTag({ id: sampleTag.id, name: "ExistingTag" }, testUserId)
      ).rejects.toThrow(ValidationError);

      expect(mockTagRepository.update).not.toHaveBeenCalled();
    });

    it("should throw NotFoundError if tag does not exist", async () => {
      vi.mocked(mockTagRepository.findById).mockResolvedValue(null);

      await expect(
        service.updateTag({ id: "non-existent-id", name: "New" }, testUserId)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("deleteTag", () => {
    it("should delete tag and log TAG_DELETED activity", async () => {
      const result = await service.deleteTag(sampleTag.id, testUserId);

      expect(mockTagRepository.findById).toHaveBeenCalledWith(sampleTag.id);
      expect(mockPermissionService.requireCanMutateTodos).toHaveBeenCalledWith(testUserId, sampleListId);
      expect(mockTagRepository.delete).toHaveBeenCalledWith(sampleTag.id, undefined);
      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TAG_DELETED",
          entityType: "TAG",
        }),
        undefined
      );
      expect(result).toEqual({ success: true, id: sampleTag.id });
    });

    it("should throw NotFoundError if tag to delete does not exist", async () => {
      vi.mocked(mockTagRepository.findById).mockResolvedValue(null);

      await expect(
        service.deleteTag("missing-tag", testUserId)
      ).rejects.toThrow(NotFoundError);

      expect(mockTagRepository.delete).not.toHaveBeenCalled();
    });

    it("should block Viewers from deleting tags", async () => {
      vi.mocked(mockPermissionService.requireCanMutateTodos).mockRejectedValue(
        new ValidationError("Viewers have read-only access.")
      );

      await expect(
        service.deleteTag(sampleTag.id, testUserId)
      ).rejects.toThrow(ValidationError);

      expect(mockTagRepository.delete).not.toHaveBeenCalled();
    });
  });
});
