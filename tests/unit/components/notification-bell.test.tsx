import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { trpc } from "@/lib/trpc/client";

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    useUtils: vi.fn(),
    notification: {
      getUnreadCount: {
        useQuery: vi.fn(),
      },
      list: {
        useQuery: vi.fn(),
      },
      markAsRead: {
        useMutation: vi.fn(),
      },
      markAllAsRead: {
        useMutation: vi.fn(),
      },
      delete: {
        useMutation: vi.fn(),
      },
    },
  },
}));

describe("NotificationBell Component", () => {
  const mockInvalidate = vi.fn();
  const mockMarkAll = vi.fn();
  const mockMarkOne = vi.fn();
  const mockDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(trpc.useUtils).mockReturnValue({
      notification: {
        getUnreadCount: { invalidate: mockInvalidate },
        list: { invalidate: mockInvalidate },
      },
    } as any);

    vi.mocked(trpc.notification.markAllAsRead.useMutation).mockReturnValue({
      mutate: mockMarkAll,
      isPending: false,
    } as any);

    vi.mocked(trpc.notification.markAsRead.useMutation).mockReturnValue({
      mutate: mockMarkOne,
      isPending: false,
    } as any);

    vi.mocked(trpc.notification.delete.useMutation).mockReturnValue({
      mutate: mockDelete,
      isPending: false,
    } as any);
  });

  it("should render bell with unread badge when count > 0", () => {
    vi.mocked(trpc.notification.getUnreadCount.useQuery).mockReturnValue({
      data: { count: 3 },
    } as any);
    vi.mocked(trpc.notification.list.useQuery).mockReturnValue({
      data: { items: [], nextCursor: null },
      isLoading: false,
      isRefetching: false,
      refetch: vi.fn(),
    } as any);

    render(<NotificationBell />);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("should open notification panel on click and display notifications", async () => {
    vi.mocked(trpc.notification.getUnreadCount.useQuery).mockReturnValue({
      data: { count: 1 },
    } as any);

    const mockNotifications = [
      {
        id: "notif-1",
        userId: "u-1",
        actorId: "u-2",
        listId: "list-1",
        type: "INVITATION_RECEIVED",
        title: "New List Invitation",
        message: "Alice invited you to collaborate on 'Design System' as EDITOR.",
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ];

    vi.mocked(trpc.notification.list.useQuery).mockReturnValue({
      data: { items: mockNotifications, nextCursor: null },
      isLoading: false,
      isRefetching: false,
      refetch: vi.fn(),
    } as any);

    render(<NotificationBell />);

    const bellBtn = screen.getByRole("button", { name: /Notifications/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText("Notifications")).toBeInTheDocument();
      expect(screen.getByText("New List Invitation")).toBeInTheDocument();
      expect(
        screen.getByText("Alice invited you to collaborate on 'Design System' as EDITOR.")
      ).toBeInTheDocument();
    });
  });

  it("should show empty state when there are no notifications", async () => {
    vi.mocked(trpc.notification.getUnreadCount.useQuery).mockReturnValue({
      data: { count: 0 },
    } as any);
    vi.mocked(trpc.notification.list.useQuery).mockReturnValue({
      data: { items: [], nextCursor: null },
      isLoading: false,
      isRefetching: false,
      refetch: vi.fn(),
    } as any);

    render(<NotificationBell />);

    const bellBtn = screen.getByRole("button", { name: /Notifications/i });
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByText("You're all caught up!")).toBeInTheDocument();
    });
  });
});

