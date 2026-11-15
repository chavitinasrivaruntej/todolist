import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationService } from "@/server/services/notification.service";
import { type INotificationRepository } from "@/server/repositories/notification.repository";
import { type Database } from "@/db";

describe("NotificationService", () => {
  let mockNotificationRepo: INotificationRepository;
  let mockDb: Database;
  let notificationService: NotificationService;

  beforeEach(() => {
    mockNotificationRepo = {
      create: vi.fn(),
      findPaginatedByUserId: vi.fn(),
      countUnreadByUserId: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      delete: vi.fn(),
    };

    mockDb = {
      execute: vi.fn(),
    } as unknown as Database;

    notificationService = new NotificationService(mockNotificationRepo, mockDb);
  });

  describe("notifyInvitationReceived", () => {
    it("should create notification when invitee is registered", async () => {
      vi.mocked(mockDb.execute).mockResolvedValue([{ id: "invitee-uuid" }] as any);
      vi.mocked(mockNotificationRepo.create).mockResolvedValue({
        id: "notif-1",
        userId: "invitee-uuid",
        actorId: "owner-uuid",
        listId: "list-1",
        type: "INVITATION_RECEIVED",
        title: "New List Invitation",
        message: "owner@example.com invited you to collaborate on 'Projects' as EDITOR.",
        isRead: false,
        createdAt: new Date(),
      });

      const result = await notificationService.notifyInvitationReceived({
        listId: "list-1",
        listName: "Projects",
        inviterId: "owner-uuid",
        inviterEmail: "owner@example.com",
        inviteeEmail: "colleague@example.com",
        role: "EDITOR",
      });

      expect(result).not.toBeNull();
      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "invitee-uuid",
          type: "INVITATION_RECEIVED",
        }),
        undefined
      );
    });

    it("should skip notification when invitee is unregistered", async () => {
      vi.mocked(mockDb.execute).mockResolvedValue([] as any); // Not found

      const result = await notificationService.notifyInvitationReceived({
        listId: "list-1",
        listName: "Projects",
        inviterId: "owner-uuid",
        inviterEmail: "owner@example.com",
        inviteeEmail: "unregistered@example.com",
        role: "EDITOR",
      });

      expect(result).toBeNull();
      expect(mockNotificationRepo.create).not.toHaveBeenCalled();
    });

    it("should suppress self-notifications", async () => {
      vi.mocked(mockDb.execute).mockResolvedValue([{ id: "user-same" }] as any);

      const result = await notificationService.notifyInvitationReceived({
        listId: "list-1",
        listName: "Projects",
        inviterId: "user-same",
        inviterEmail: "same@example.com",
        inviteeEmail: "same@example.com",
        role: "EDITOR",
      });

      expect(result).toBeNull();
      expect(mockNotificationRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("notifyInvitationAccepted", () => {
    it("should create notification for list owner", async () => {
      vi.mocked(mockNotificationRepo.create).mockResolvedValue({
        id: "notif-2",
        userId: "owner-uuid",
        actorId: "acceptor-uuid",
        listId: "list-1",
        type: "INVITATION_ACCEPTED",
        title: "Invitation Accepted",
        message: "acceptor@example.com accepted your invitation to 'Projects'.",
        isRead: false,
        createdAt: new Date(),
      });

      const result = await notificationService.notifyInvitationAccepted({
        listId: "list-1",
        listName: "Projects",
        acceptorId: "acceptor-uuid",
        acceptorEmail: "acceptor@example.com",
        ownerId: "owner-uuid",
      });

      expect(result).not.toBeNull();
      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "owner-uuid",
          actorId: "acceptor-uuid",
          type: "INVITATION_ACCEPTED",
        }),
        undefined
      );
    });
  });

  describe("notifyMemberRemoved", () => {
    it("should create notification for removed member", async () => {
      vi.mocked(mockNotificationRepo.create).mockResolvedValue({
        id: "notif-3",
        userId: "member-uuid",
        actorId: "owner-uuid",
        listId: "list-1",
        type: "MEMBER_REMOVED",
        title: "Removed from List",
        message: "You were removed from the list 'Projects' by owner@example.com.",
        isRead: false,
        createdAt: new Date(),
      });

      const result = await notificationService.notifyMemberRemoved({
        listId: "list-1",
        listName: "Projects",
        actorId: "owner-uuid",
        actorEmail: "owner@example.com",
        memberUserId: "member-uuid",
      });

      expect(result).not.toBeNull();
      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "member-uuid",
          type: "MEMBER_REMOVED",
        }),
        undefined
      );
    });
  });

  describe("notifyMemberLeft", () => {
    it("should create notification for list owner", async () => {
      vi.mocked(mockNotificationRepo.create).mockResolvedValue({
        id: "notif-4",
        userId: "owner-uuid",
        actorId: "member-uuid",
        listId: "list-1",
        type: "MEMBER_LEFT",
        title: "Member Left List",
        message: "member@example.com left the list 'Projects'.",
        isRead: false,
        createdAt: new Date(),
      });

      const result = await notificationService.notifyMemberLeft({
        listId: "list-1",
        listName: "Projects",
        memberUserId: "member-uuid",
        memberEmail: "member@example.com",
        ownerId: "owner-uuid",
      });

      expect(result).not.toBeNull();
      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "owner-uuid",
          type: "MEMBER_LEFT",
        }),
        undefined
      );
    });
  });

  describe("notifyMemberRoleChanged", () => {
    it("should create notification for member whose role was updated", async () => {
      vi.mocked(mockNotificationRepo.create).mockResolvedValue({
        id: "notif-5",
        userId: "member-uuid",
        actorId: "owner-uuid",
        listId: "list-1",
        type: "MEMBER_ROLE_CHANGED",
        title: "Role Updated",
        message: "Your role on list 'Projects' was updated to VIEWER by owner@example.com.",
        isRead: false,
        createdAt: new Date(),
      });

      const result = await notificationService.notifyMemberRoleChanged({
        listId: "list-1",
        listName: "Projects",
        actorId: "owner-uuid",
        actorEmail: "owner@example.com",
        memberUserId: "member-uuid",
        newRole: "VIEWER",
      });

      expect(result).not.toBeNull();
      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "member-uuid",
          type: "MEMBER_ROLE_CHANGED",
        }),
        undefined
      );
    });
  });

  describe("notifyInvitationRevoked", () => {
    it("should create notification for registered invitee", async () => {
      vi.mocked(mockDb.execute).mockResolvedValue([{ id: "invitee-uuid" }] as any);
      vi.mocked(mockNotificationRepo.create).mockResolvedValue({
        id: "notif-6",
        userId: "invitee-uuid",
        actorId: "owner-uuid",
        listId: "list-1",
        type: "INVITATION_REVOKED",
        title: "Invitation Revoked",
        message: "The invitation to 'Projects' was revoked by owner@example.com.",
        isRead: false,
        createdAt: new Date(),
      });

      const result = await notificationService.notifyInvitationRevoked({
        listId: "list-1",
        listName: "Projects",
        actorId: "owner-uuid",
        actorEmail: "owner@example.com",
        inviteeEmail: "colleague@example.com",
      });

      expect(result).not.toBeNull();
      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "invitee-uuid",
          type: "INVITATION_REVOKED",
        }),
        undefined
      );
    });
  });

  describe("error resilience", () => {
    it("should catch repository error, log it, and return null without throwing", async () => {
      vi.mocked(mockDb.execute).mockResolvedValue([{ id: "invitee-uuid" }] as any);
      vi.mocked(mockNotificationRepo.create).mockRejectedValue(
        new Error("Database connection lost")
      );

      const spyConsole = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await notificationService.notifyInvitationReceived({
        listId: "list-1",
        listName: "Projects",
        inviterId: "owner-uuid",
        inviterEmail: "owner@example.com",
        inviteeEmail: "colleague@example.com",
        role: "EDITOR",
      });

      expect(result).toBeNull();
      expect(spyConsole).toHaveBeenCalledWith(
        "[NotificationDeliveryError]",
        expect.objectContaining({
          type: "INVITATION_RECEIVED",
        })
      );

      spyConsole.mockRestore();
    });
  });

  describe("inbox management & unread operations", () => {
    it("should retrieve unread count", async () => {
      vi.mocked(mockNotificationRepo.countUnreadByUserId).mockResolvedValue(5);
      const count = await notificationService.getUnreadCount("u-1");
      expect(count).toBe(5);
    });

    it("should mark single notification as read", async () => {
      vi.mocked(mockNotificationRepo.markAsRead).mockResolvedValue(true);
      const success = await notificationService.markAsRead("notif-1", "u-1");
      expect(success).toBe(true);
    });

    it("should mark all as read", async () => {
      vi.mocked(mockNotificationRepo.markAllAsRead).mockResolvedValue(3);
      const count = await notificationService.markAllAsRead("u-1");
      expect(count).toBe(3);
    });

    it("should delete notification", async () => {
      vi.mocked(mockNotificationRepo.delete).mockResolvedValue(true);
      const success = await notificationService.deleteNotification("notif-1", "u-1");
      expect(success).toBe(true);
    });
  });
});

