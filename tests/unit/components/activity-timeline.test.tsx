import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { ActivityTimeline } from "@/components/todos/activity/activity-timeline";
import { trpc } from "@/lib/trpc/client";

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    activity: {
      listByList: {
        useQuery: vi.fn(),
      },
    },
  },
}));

describe("ActivityTimeline Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render loading state when fetching activities", () => {
    vi.mocked(trpc.activity.listByList.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isRefetching: false,
      refetch: vi.fn(),
      error: null,
    } as any);

    render(<ActivityTimeline listId="list-1" />);

    expect(screen.getByText("Loading activity history...")).toBeInTheDocument();
  });

  it("should render activity events cleanly", async () => {
    const mockActivities = [
      {
        id: "act-1",
        listId: "list-1",
        actorId: "user-1",
        actorEmail: "alice@example.com",
        action: "TODO_CREATED",
        entityType: "TODO",
        entityId: "t-1",
        metadata: { title: "Deploy to Vercel", status: "TODO" },
        createdAt: new Date().toISOString(),
      },
      {
        id: "act-2",
        listId: "list-1",
        actorId: "user-1",
        actorEmail: "alice@example.com",
        action: "INVITATION_CREATED",
        entityType: "INVITATION",
        entityId: "inv-1",
        metadata: { email: "bob@example.com", role: "EDITOR" },
        createdAt: new Date().toISOString(),
      },
    ];

    vi.mocked(trpc.activity.listByList.useQuery).mockReturnValue({
      data: { items: mockActivities, nextCursor: null },
      isLoading: false,
      isRefetching: false,
      refetch: vi.fn(),
      error: null,
    } as any);

    render(<ActivityTimeline listId="list-1" />);

    await waitFor(() => {
      expect(screen.getByText("Activity Timeline")).toBeInTheDocument();
      expect(screen.getByText('"Deploy to Vercel"')).toBeInTheDocument();
      expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    });
  });

  it("should render empty state when list has no recorded activities", () => {
    vi.mocked(trpc.activity.listByList.useQuery).mockReturnValue({
      data: { items: [], nextCursor: null },
      isLoading: false,
      isRefetching: false,
      refetch: vi.fn(),
      error: null,
    } as any);

    render(<ActivityTimeline listId="list-1" />);

    expect(screen.getByText("No activity recorded yet")).toBeInTheDocument();
  });
});

