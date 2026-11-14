import { describe, it, expect, vi, beforeEach } from "vitest";
import { TodoListService } from "@/server/services/todo-list.service";
import {
  type ITodoListRepository,
  type TodoListWithTaskCount,
} from "@/server/repositories/todo-list.repository";
import { type IListMemberRepository } from "@/server/repositories/list-member.repository";
import { ListPermissionService } from "@/server/services/list-permission.service";
import { NotFoundError, ValidationError } from "@/server/errors";

describe("TodoListService", () => {
  let mockRepository: ITodoListRepository;
  let mockMemberRepository: IListMemberRepository;
  let mockPermissionService: ListPermissionService;
  let service: TodoListService;

  const testUserId = "user-test-uuid";
  const mockDate = new Date("2026-01-01T00:00:00.000Z");
  const sampleList: TodoListWithTaskCount = {
    id: "11111111-1111-1111-1111-111111111111",
    userId: testUserId,
    name: "Projects",
    createdAt: mockDate,
    updatedAt: mockDate,
    taskCount: 3,
    effectiveRole: "OWNER",
  };

  beforeEach(() => {
    mockRepository = {
      findAllWithTaskCounts: vi.fn(),
      findOwnedWithTaskCounts: vi.fn(),
      findSharedWithTaskCounts: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateName: vi.fn(),
      delete: vi.fn(),
      countTasksByListId: vi.fn(),
    };

    mockMemberRepository = {
      findById: vi.fn(),
      findByListAndUser: vi.fn(),
      findAllByListId: vi.fn(),
      addMember: vi.fn(),
      updateRole: vi.fn(),
      deleteMember: vi.fn(),
      deleteByListAndUser: vi.fn(),
    };

    mockPermissionService = {
      getUserRole: vi.fn().mockResolvedValue("OWNER"),
      requireOwner: vi.fn().mockResolvedValue(undefined),
      requireCanMutateTodos: vi.fn().mockResolvedValue("OWNER"),
      requireCanReadList: vi.fn().mockResolvedValue("OWNER"),
    } as unknown as ListPermissionService;

    service = new TodoListService(
      mockRepository,
      mockMemberRepository,
      mockPermissionService
    );
  });

  describe("getLists", () => {
    it("should return lists with task counts from repository for user", async () => {
      vi.mocked(mockRepository.findAllWithTaskCounts).mockResolvedValue([
        sampleList,
      ]);

      const result = await service.getLists(testUserId);

      expect(mockRepository.findAllWithTaskCounts).toHaveBeenCalledWith(
        testUserId
      );
      expect(result).toEqual([sampleList]);
    });

    it("should automatically create a default 'Personal' list if user has no lists", async () => {
      vi.mocked(mockRepository.findAllWithTaskCounts).mockResolvedValue([]);
      const defaultCreated = {
        id: "22222222-2222-2222-2222-222222222222",
        userId: testUserId,
        name: "Personal",
        createdAt: mockDate,
        updatedAt: mockDate,
      };
      vi.mocked(mockRepository.create).mockResolvedValue(defaultCreated);

      const result = await service.getLists(testUserId);

      expect(mockRepository.create).toHaveBeenCalledWith({
        name: "Personal",
        userId: testUserId,
      });
      expect(result).toEqual([
        {
          ...defaultCreated,
          taskCount: 0,
          effectiveRole: "OWNER",
        },
      ]);
    });
  });

  describe("getOwnedLists and getSharedLists", () => {
    it("should query owned lists via repository", async () => {
      vi.mocked(mockRepository.findOwnedWithTaskCounts).mockResolvedValue([sampleList]);
      const res = await service.getOwnedLists(testUserId);
      expect(mockRepository.findOwnedWithTaskCounts).toHaveBeenCalledWith(testUserId);
      expect(res).toEqual([sampleList]);
    });

    it("should query shared lists via repository", async () => {
      vi.mocked(mockRepository.findSharedWithTaskCounts).mockResolvedValue([]);
      const res = await service.getSharedLists(testUserId);
      expect(mockRepository.findSharedWithTaskCounts).toHaveBeenCalledWith(testUserId);
      expect(res).toEqual([]);
    });
  });

  describe("createList", () => {
    it("should create a new list with trimmed name", async () => {
      const createdList = {
        id: "33333333-3333-3333-3333-333333333333",
        userId: testUserId,
        name: "College",
        createdAt: mockDate,
        updatedAt: mockDate,
      };
      vi.mocked(mockRepository.create).mockResolvedValue(createdList);

      const result = await service.createList(
        { name: "  College  " },
        testUserId
      );

      expect(mockRepository.create).toHaveBeenCalledWith({
        name: "College",
        userId: testUserId,
      });
      expect(result.name).toBe("College");
    });

    it("should throw ValidationError when name is solely whitespace", async () => {
      await expect(
        service.createList({ name: "   " }, testUserId)
      ).rejects.toThrow(ValidationError);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("renameList", () => {
    it("should rename an existing list scoped to owner", async () => {
      vi.mocked(mockRepository.updateName).mockResolvedValue({
        ...sampleList,
        name: "Work Projects",
      });

      const result = await service.renameList(
        {
          id: sampleList.id,
          name: "  Work Projects  ",
        },
        testUserId
      );

      expect(mockPermissionService.requireOwner).toHaveBeenCalledWith(
        testUserId,
        sampleList.id
      );
      expect(mockRepository.updateName).toHaveBeenCalledWith(
        sampleList.id,
        "Work Projects"
      );
      expect(result.name).toBe("Work Projects");
    });

    it("should throw ValidationError if new name is empty", async () => {
      await expect(
        service.renameList({ id: sampleList.id, name: " " }, testUserId)
      ).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError if list is not found on update", async () => {
      vi.mocked(mockRepository.updateName).mockResolvedValue(null);

      await expect(
        service.renameList(
          { id: sampleList.id, name: "New Name" },
          testUserId
        )
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("deleteList", () => {
    it("should throw NotFoundError if list does not exist", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      await expect(
        service.deleteList({ id: sampleList.id, force: false }, testUserId)
      ).rejects.toThrow(NotFoundError);
    });

    it("should block deletion and throw ValidationError if list contains tasks and force=false", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(sampleList);
      vi.mocked(mockRepository.countTasksByListId).mockResolvedValue(3);

      await expect(
        service.deleteList({ id: sampleList.id, force: false }, testUserId)
      ).rejects.toThrow(ValidationError);

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it("should allow deletion if list contains tasks when force=true", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(sampleList);
      vi.mocked(mockRepository.countTasksByListId).mockResolvedValue(3);
      vi.mocked(mockRepository.delete).mockResolvedValue(true);

      const result = await service.deleteList(
        { id: sampleList.id, force: true },
        testUserId
      );

      expect(mockPermissionService.requireOwner).toHaveBeenCalledWith(
        testUserId,
        sampleList.id
      );
      expect(mockRepository.delete).toHaveBeenCalledWith(sampleList.id);
      expect(result).toEqual({ success: true, id: sampleList.id });
    });

    it("should allow deletion if list is empty even when force=false", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(sampleList);
      vi.mocked(mockRepository.countTasksByListId).mockResolvedValue(0);
      vi.mocked(mockRepository.delete).mockResolvedValue(true);

      const result = await service.deleteList(
        { id: sampleList.id, force: false },
        testUserId
      );

      expect(mockPermissionService.requireOwner).toHaveBeenCalledWith(
        testUserId,
        sampleList.id
      );
      expect(mockRepository.delete).toHaveBeenCalledWith(sampleList.id);
      expect(result).toEqual({ success: true, id: sampleList.id });
    });
  });

  describe("leaveList", () => {
    it("should prevent list owner from leaving their own list", async () => {
      vi.mocked(mockPermissionService.getUserRole).mockResolvedValue("OWNER");

      await expect(
        service.leaveList({ listId: sampleList.id }, testUserId)
      ).rejects.toThrow(ValidationError);
    });

    it("should allow collaborator to leave list", async () => {
      vi.mocked(mockPermissionService.getUserRole).mockResolvedValue("EDITOR");
      vi.mocked(mockMemberRepository.deleteByListAndUser).mockResolvedValue(true);

      const res = await service.leaveList({ listId: sampleList.id }, testUserId);
      expect(res).toEqual({ success: true, listId: sampleList.id });
      expect(mockMemberRepository.deleteByListAndUser).toHaveBeenCalledWith(
        sampleList.id,
        testUserId
      );
    });
  });
});
