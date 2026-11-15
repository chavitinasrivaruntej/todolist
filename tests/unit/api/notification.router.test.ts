import { describe, it, expect, vi, beforeEach } from "vitest";
import { notificationRouter } from "@/server/api/routers/notification.router";
import { notificationService } from "@/server/services/notification.service";

vi.mock("@/server/services/notification.service", () => ({
  notificationService: {
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
  },
}));

describe("Notification tRPC Router", () => {
  const mockUser = {
    id: "user-1",
    email: "user1@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const createCaller = (user: any) =>
    notificationRouter.createCaller({
      user,
      headers: new Headers(),
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return notifications for authenticated user", async () => {
    const caller = createCaller(mockUser);
    const mockData = {
      items: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          userId: "user-1",
          actorId: "user-2",
          listId: "00000000-0000-4000-8000-000000000002",
          type: "INVITATION_RECEIVED" as const,
          title: "New Invite",
          message: "You were invited",
          isRead: false,
          createdAt: new Date(),
        },
      ],
      nextCursor: null,
    };

    vi.mocked(notificationService.getNotifications).mockResolvedValue(mockData);

    const result = await caller.list({});
    expect(result).toEqual(mockData);
    expect(notificationService.getNotifications).toHaveBeenCalledWith("user-1", {
      limit: 20,
      cursor: undefined,
    });
  });

  it("should retrieve unread count", async () => {
    const caller = createCaller(mockUser);
    vi.mocked(notificationService.getUnreadCount).mockResolvedValue(4);

    const result = await caller.getUnreadCount();
    expect(result).toEqual({ count: 4 });
    expect(notificationService.getUnreadCount).toHaveBeenCalledWith("user-1");
  });

  it("should mark a single notification as read", async () => {
    const caller = createCaller(mockUser);
    vi.mocked(notificationService.markAsRead).mockResolvedValue(true);

    const result = await caller.markAsRead({
      id: "00000000-0000-4000-8000-000000000001",
    });

    expect(result).toEqual({
      success: true,
      id: "00000000-0000-4000-8000-000000000001",
    });
    expect(notificationService.markAsRead).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "user-1"
    );
  });

  it("should mark all as read", async () => {
    const caller = createCaller(mockUser);
    vi.mocked(notificationService.markAllAsRead).mockResolvedValue(2);

    const result = await caller.markAllAsRead();
    expect(result).toEqual({ success: true, updatedCount: 2 });
    expect(notificationService.markAllAsRead).toHaveBeenCalledWith("user-1");
  });

  it("should delete a notification", async () => {
    const caller = createCaller(mockUser);
    vi.mocked(notificationService.deleteNotification).mockResolvedValue(true);

    const result = await caller.delete({
      id: "00000000-0000-4000-8000-000000000001",
    });

    expect(result).toEqual({
      success: true,
      id: "00000000-0000-4000-8000-000000000001",
    });
    expect(notificationService.deleteNotification).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "user-1"
    );
  });
});

