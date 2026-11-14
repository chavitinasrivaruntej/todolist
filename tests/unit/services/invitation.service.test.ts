import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvitationService } from "@/server/services/invitation.service";
import { type IInvitationRepository } from "@/server/repositories/invitation.repository";
import { type ITodoListRepository } from "@/server/repositories/todo-list.repository";
import { type IListMemberRepository } from "@/server/repositories/list-member.repository";
import { ListPermissionService } from "@/server/services/list-permission.service";
import { type IEmailService } from "@/server/services/email/email.service";
import { NotFoundError, ValidationError } from "@/server/errors";

describe("InvitationService", () => {
  let mockInvitationRepo: IInvitationRepository;
  let mockListRepo: ITodoListRepository;
  let mockMemberRepo: IListMemberRepository;
  let mockPermissionService: ListPermissionService;
  let mockEmailService: IEmailService;
  let service: InvitationService;

  const ownerId = "owner-uuid-111";
  const ownerEmail = "owner@example.com";
  const listId = "list-uuid-999";
  const targetEmail = "colleague@example.com";

  const sampleList = {
    id: listId,
    userId: ownerId,
    name: "Sprint 42",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockInvitationRepo = {
      findByTokenHash: vi.fn(),
      findById: vi.fn(),
      findPendingByListId: vi.fn(),
      findPendingByEmailAndList: vi.fn(),
      create: vi.fn(),
      updateTokenAndExpiry: vi.fn(),
      updateStatus: vi.fn(),
      delete: vi.fn(),
    };

    mockListRepo = {
      findAllWithTaskCounts: vi.fn(),
      findOwnedWithTaskCounts: vi.fn(),
      findSharedWithTaskCounts: vi.fn(),
      findById: vi.fn().mockResolvedValue(sampleList),
      create: vi.fn(),
      updateName: vi.fn(),
      delete: vi.fn(),
      countTasksByListId: vi.fn(),
    };

    mockMemberRepo = {
      findById: vi.fn(),
      findByListAndUser: vi.fn(),
      findAllByListId: vi.fn().mockResolvedValue([]),
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

    mockEmailService = {
      sendInvitationEmail: vi.fn().mockResolvedValue({ success: true }),
    };

    service = new InvitationService(
      mockInvitationRepo,
      mockListRepo,
      mockMemberRepo,
      mockPermissionService,
      mockEmailService
    );
  });

  describe("createInvitation", () => {
    it("should prevent owner from inviting themselves", async () => {
      await expect(
        service.createInvitation(
          { listId, email: ownerEmail, role: "EDITOR" },
          ownerId,
          ownerEmail
        )
      ).rejects.toThrow(ValidationError);

      expect(mockInvitationRepo.create).not.toHaveBeenCalled();
    });

    it("should prevent inviting someone who is already a member", async () => {
      vi.mocked(mockMemberRepo.findAllByListId).mockResolvedValue([
        {
          id: "m-1",
          listId,
          userId: "user-222",
          role: "EDITOR",
          email: targetEmail,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await expect(
        service.createInvitation(
          { listId, email: targetEmail, role: "EDITOR" },
          ownerId,
          ownerEmail
        )
      ).rejects.toThrow(ValidationError);
    });

    it("should create a new invitation record and dispatch email", async () => {
      vi.mocked(mockInvitationRepo.findPendingByEmailAndList).mockResolvedValue(null);
      vi.mocked(mockInvitationRepo.create).mockResolvedValue({
        id: "inv-1",
        listId,
        inviterId: ownerId,
        email: targetEmail,
        role: "EDITOR",
        tokenHash: "abc-sha256-hash",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: null,
        createdAt: new Date(),
      });

      const res = await service.createInvitation(
        { listId, email: targetEmail, role: "EDITOR" },
        ownerId,
        ownerEmail
      );

      expect(res.success).toBe(true);
      expect(res.invitationId).toBe("inv-1");
      expect(mockInvitationRepo.create).toHaveBeenCalled();
      expect(mockEmailService.sendInvitationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: targetEmail,
          inviterEmail: ownerEmail,
          listName: "Sprint 42",
          role: "EDITOR",
        })
      );
    });

    it("should renew existing pending invitation if one already exists", async () => {
      const existingPending = {
        id: "inv-existing",
        listId,
        inviterId: ownerId,
        email: targetEmail,
        role: "VIEWER" as const,
        tokenHash: "old-hash",
        status: "PENDING" as const,
        expiresAt: new Date(),
        acceptedAt: null,
        createdAt: new Date(),
      };
      vi.mocked(mockInvitationRepo.findPendingByEmailAndList).mockResolvedValue(existingPending);
      vi.mocked(mockInvitationRepo.updateTokenAndExpiry).mockResolvedValue({
        ...existingPending,
        role: "EDITOR",
      });

      const res = await service.createInvitation(
        { listId, email: targetEmail, role: "EDITOR" },
        ownerId,
        ownerEmail
      );

      expect(res.success).toBe(true);
      expect(mockInvitationRepo.updateTokenAndExpiry).toHaveBeenCalled();
      expect(mockInvitationRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("acceptInvitation", () => {
    const rawToken = "my-secure-32-byte-hex-token";
    const pendingInvitation = {
      id: "inv-123",
      listId,
      inviterId: ownerId,
      email: targetEmail,
      role: "EDITOR" as const,
      tokenHash: "hash-value",
      status: "PENDING" as const,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour in future
      acceptedAt: null,
      createdAt: new Date(),
    };

    it("should reject acceptance if session email does not match invited email", async () => {
      vi.mocked(mockInvitationRepo.findByTokenHash).mockResolvedValue(pendingInvitation);

      await expect(
        service.acceptInvitation(rawToken, "user-impostor", "wrong@example.com")
      ).rejects.toThrow(ValidationError);

      expect(mockMemberRepo.addMember).not.toHaveBeenCalled();
    });

    it("should reject acceptance if invitation has expired", async () => {
      vi.mocked(mockInvitationRepo.findByTokenHash).mockResolvedValue({
        ...pendingInvitation,
        expiresAt: new Date(Date.now() - 10000), // In past
      });

      await expect(
        service.acceptInvitation(rawToken, "user-target", targetEmail)
      ).rejects.toThrow(ValidationError);

      expect(mockInvitationRepo.updateStatus).toHaveBeenCalledWith("inv-123", "EXPIRED");
    });

    it("should successfully provision membership when session email matches", async () => {
      vi.mocked(mockInvitationRepo.findByTokenHash).mockResolvedValue(pendingInvitation);
      vi.mocked(mockMemberRepo.findByListAndUser).mockResolvedValue(null);

      const res = await service.acceptInvitation(rawToken, "user-target", targetEmail);

      expect(res.success).toBe(true);
      expect(res.listId).toBe(listId);
      expect(mockMemberRepo.addMember).toHaveBeenCalledWith({
        listId,
        userId: "user-target",
        role: "EDITOR",
      });
      expect(mockInvitationRepo.updateStatus).toHaveBeenCalledWith(
        "inv-123",
        "ACCEPTED",
        expect.any(Date)
      );
    });
  });

  describe("revokeInvitation", () => {
    it("should require OWNER role and mark invitation REVOKED", async () => {
      vi.mocked(mockInvitationRepo.findById).mockResolvedValue({
        id: "inv-123",
        listId,
        inviterId: ownerId,
        email: targetEmail,
        role: "EDITOR",
        tokenHash: "h",
        status: "PENDING",
        expiresAt: new Date(),
        acceptedAt: null,
        createdAt: new Date(),
      });
      vi.mocked(mockInvitationRepo.updateStatus).mockResolvedValue({
        id: "inv-123",
        listId,
        inviterId: ownerId,
        email: targetEmail,
        role: "EDITOR",
        tokenHash: "h",
        status: "REVOKED",
        expiresAt: new Date(),
        acceptedAt: null,
        createdAt: new Date(),
      });

      const res = await service.revokeInvitation("inv-123", ownerId);
      expect(res).toEqual({ success: true, id: "inv-123" });
      expect(mockPermissionService.requireOwner).toHaveBeenCalledWith(ownerId, listId);
      expect(mockInvitationRepo.updateStatus).toHaveBeenCalledWith("inv-123", "REVOKED");
    });
  });
});

