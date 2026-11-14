import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListPermissionService } from "@/server/services/list-permission.service";
import { type ITodoListRepository } from "@/server/repositories/todo-list.repository";
import { type IListMemberRepository } from "@/server/repositories/list-member.repository";
import { NotFoundError, ValidationError } from "@/server/errors";

describe("ListPermissionService", () => {
  let mockListRepo: ITodoListRepository;
  let mockMemberRepo: IListMemberRepository;
  let permissionService: ListPermissionService;

  const ownerId = "owner-uuid-111";
  const editorId = "editor-uuid-222";
  const viewerId = "viewer-uuid-333";
  const outsiderId = "outsider-uuid-444";
  const listId = "list-uuid-999";

  const sampleList = {
    id: listId,
    userId: ownerId,
    name: "Team Roadmap",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockListRepo = {
      findAllWithTaskCounts: vi.fn(),
      findOwnedWithTaskCounts: vi.fn(),
      findSharedWithTaskCounts: vi.fn(),
      findById: vi.fn().mockImplementation(async (id: string) => {
        return id === listId ? sampleList : null;
      }),
      create: vi.fn(),
      updateName: vi.fn(),
      delete: vi.fn(),
      countTasksByListId: vi.fn(),
    };

    mockMemberRepo = {
      findById: vi.fn(),
      findByListAndUser: vi.fn().mockImplementation(async (lId: string, uId: string) => {
        if (lId !== listId) return null;
        if (uId === editorId) {
          return {
            id: "m-1",
            listId,
            userId: editorId,
            role: "EDITOR",
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
        if (uId === viewerId) {
          return {
            id: "m-2",
            listId,
            userId: viewerId,
            role: "VIEWER",
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
        return null;
      }),
      findAllByListId: vi.fn(),
      addMember: vi.fn(),
      updateRole: vi.fn(),
      deleteMember: vi.fn(),
      deleteByListAndUser: vi.fn(),
    };

    permissionService = new ListPermissionService(mockListRepo, mockMemberRepo);
  });

  describe("getUserRole", () => {
    it("should resolve OWNER for list owner", async () => {
      const role = await permissionService.getUserRole(ownerId, listId);
      expect(role).toBe("OWNER");
    });

    it("should resolve EDITOR for list editor member", async () => {
      const role = await permissionService.getUserRole(editorId, listId);
      expect(role).toBe("EDITOR");
    });

    it("should resolve VIEWER for list viewer member", async () => {
      const role = await permissionService.getUserRole(viewerId, listId);
      expect(role).toBe("VIEWER");
    });

    it("should resolve null for unauthorized outsider", async () => {
      const role = await permissionService.getUserRole(outsiderId, listId);
      expect(role).toBeNull();
    });

    it("should resolve null for nonexistent list", async () => {
      const role = await permissionService.getUserRole(ownerId, "non-existent-list");
      expect(role).toBeNull();
    });
  });

  describe("requireOwner", () => {
    it("should succeed for OWNER", async () => {
      await expect(permissionService.requireOwner(ownerId, listId)).resolves.not.toThrow();
    });

    it("should reject EDITOR with ValidationError", async () => {
      await expect(permissionService.requireOwner(editorId, listId)).rejects.toThrow(ValidationError);
    });

    it("should reject VIEWER with ValidationError", async () => {
      await expect(permissionService.requireOwner(viewerId, listId)).rejects.toThrow(ValidationError);
    });

    it("should reject outsider with NotFoundError to prevent information disclosure", async () => {
      await expect(permissionService.requireOwner(outsiderId, listId)).rejects.toThrow(NotFoundError);
    });
  });

  describe("requireCanMutateTodos", () => {
    it("should permit OWNER to mutate tasks", async () => {
      const role = await permissionService.requireCanMutateTodos(ownerId, listId);
      expect(role).toBe("OWNER");
    });

    it("should permit EDITOR to mutate tasks", async () => {
      const role = await permissionService.requireCanMutateTodos(editorId, listId);
      expect(role).toBe("EDITOR");
    });

    it("should block VIEWER from mutating tasks with ValidationError", async () => {
      await expect(permissionService.requireCanMutateTodos(viewerId, listId)).rejects.toThrow(ValidationError);
    });

    it("should block outsider with NotFoundError", async () => {
      await expect(permissionService.requireCanMutateTodos(outsiderId, listId)).rejects.toThrow(NotFoundError);
    });
  });

  describe("requireCanReadList", () => {
    it("should permit OWNER to read list", async () => {
      const role = await permissionService.requireCanReadList(ownerId, listId);
      expect(role).toBe("OWNER");
    });

    it("should permit EDITOR to read list", async () => {
      const role = await permissionService.requireCanReadList(editorId, listId);
      expect(role).toBe("EDITOR");
    });

    it("should permit VIEWER to read list", async () => {
      const role = await permissionService.requireCanReadList(viewerId, listId);
      expect(role).toBe("VIEWER");
    });

    it("should reject outsider with NotFoundError", async () => {
      await expect(permissionService.requireCanReadList(outsiderId, listId)).rejects.toThrow(NotFoundError);
    });
  });
});

