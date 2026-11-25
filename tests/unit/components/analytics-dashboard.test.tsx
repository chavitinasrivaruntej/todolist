import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

const mockUseSearchParams = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/components/auth/user-menu", () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}));

vi.mock("@/components/notifications/notification-bell", () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

const mockListsQuery = vi.fn();
const mockOverviewQuery = vi.fn();
const mockVelocityQuery = vi.fn();

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    todoList: {
      list: {
        useQuery: (...args: unknown[]) => mockListsQuery(...args),
      },
    },
    analytics: {
      getOverview: {
        useQuery: (...args: unknown[]) => mockOverviewQuery(...args),
      },
      getVelocity: {
        useQuery: (...args: unknown[]) => mockVelocityQuery(...args),
      },
    },
  },
}));

describe("AnalyticsDashboard UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    mockListsQuery.mockReturnValue({
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Work",
          effectiveRole: "OWNER",
          taskCount: 5,
        },
      ],
    });
  });

  it("renders loading skeleton while queries are pending", () => {
    mockOverviewQuery.mockReturnValue({ isLoading: true, isError: false });
    mockVelocityQuery.mockReturnValue({ isLoading: true, isError: false });

    render(<AnalyticsDashboard />);
    expect(screen.getByLabelText("Loading analytics")).toBeInTheDocument();
  });

  it("renders error state with retry button", () => {
    const refetchOverview = vi.fn();
    const refetchVelocity = vi.fn();

    mockOverviewQuery.mockReturnValue({
      isLoading: false,
      isError: true,
      error: { message: "Database unreachable" },
      refetch: refetchOverview,
    });
    mockVelocityQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      refetch: refetchVelocity,
    });

    render(<AnalyticsDashboard />);
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load analytics metrics.");
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetchOverview).toHaveBeenCalledTimes(1);
    expect(refetchVelocity).toHaveBeenCalledTimes(1);
  });

  it("renders empty state when user has no tasks or historical events", () => {
    mockOverviewQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        scope: {
          type: "all-accessible-lists",
          listId: null,
          listName: null,
          accessibleListCount: 1,
        },
        reportingDate: "2026-11-25",
        reportingTimezone: "UTC",
        totalTasks: 0,
        completedTasks: 0,
        openTasks: 0,
        overdueTasks: 0,
        currentCompletionRate: 0,
        statusDistribution: [
          { status: "TODO", count: 0 },
          { status: "IN_PROGRESS", count: 0 },
          { status: "DONE", count: 0 },
        ],
        priorityDistribution: [
          { priority: "URGENT", count: 0 },
          { priority: "HIGH", count: 0 },
          { priority: "MEDIUM", count: 0 },
          { priority: "LOW", count: 0 },
        ],
        tagDistribution: [],
      },
    });
    mockVelocityQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        scope: { type: "all-accessible-lists", listId: null, listName: null },
        range: "90d",
        timezone: "UTC",
        rangeStart: "2026-08-28T00:00:00.000Z",
        rangeEnd: "2026-11-26T00:00:00.000Z",
        historicalCoverageStart: null,
        totalCreated: 0,
        totalCompletedEvents: 0,
        averageWeeklyCompletions: 0,
        netActivity: 0,
        weeks: [],
      },
    });

    render(<AnalyticsDashboard />);
    expect(screen.getByText("No task analytics data yet")).toBeInTheDocument();
  });

  it("renders overview cards, velocity chart, table toggle, and distribution breakdowns", () => {
    mockOverviewQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        scope: {
          type: "all-accessible-lists",
          listId: null,
          listName: null,
          accessibleListCount: 1,
        },
        reportingDate: "2026-11-25",
        reportingTimezone: "UTC",
        totalTasks: 10,
        completedTasks: 4,
        openTasks: 6,
        overdueTasks: 2,
        currentCompletionRate: 40,
        statusDistribution: [
          { status: "TODO", count: 4 },
          { status: "IN_PROGRESS", count: 2 },
          { status: "DONE", count: 4 },
        ],
        priorityDistribution: [
          { priority: "URGENT", count: 1 },
          { priority: "HIGH", count: 3 },
          { priority: "MEDIUM", count: 4 },
          { priority: "LOW", count: 2 },
        ],
        tagDistribution: [
          { tagId: "tag-1", name: "Backend", color: "blue", count: 3 },
        ],
      },
    });
    mockVelocityQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        scope: { type: "all-accessible-lists", listId: null, listName: null },
        range: "90d",
        timezone: "UTC",
        rangeStart: "2026-08-28T00:00:00.000Z",
        rangeEnd: "2026-11-26T00:00:00.000Z",
        historicalCoverageStart: "2026-10-01T09:00:00.000Z",
        totalCreated: 12,
        totalCompletedEvents: 8,
        averageWeeklyCompletions: 4,
        netActivity: 4,
        weeks: [
          {
            weekStart: "2026-11-16",
            weekLabel: "Nov 16",
            createdCount: 5,
            completedCount: 3,
            netActivity: 2,
          },
          {
            weekStart: "2026-11-23",
            weekLabel: "Nov 23",
            createdCount: 7,
            completedCount: 5,
            netActivity: 2,
          },
        ],
      },
    });

    render(<AnalyticsDashboard />);

    expect(screen.getByText("Total Tasks")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Current completion rate: 40%")).toBeInTheDocument();
    expect(screen.getByText("Status Distribution")).toBeInTheDocument();
    expect(screen.getByText("Priority Distribution")).toBeInTheDocument();
    expect(screen.getByText("Tag Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
    expect(
      screen.getByText(/Activity history available since 2026-10-01 \(UTC\)/i)
    ).toBeInTheDocument();

    // Toggle to accessible Table view
    fireEvent.click(screen.getByRole("button", { name: /table view/i }));
    expect(screen.getByText("2026-11-16")).toBeInTheDocument();
    expect(screen.getByText("2026-11-23")).toBeInTheDocument();
  });
});
