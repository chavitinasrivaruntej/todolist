import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { KanbanBoard } from "@/components/todos/kanban/kanban-board";
import { trpc } from "@/lib/trpc/client";

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    useUtils: vi.fn(),
    todo: {
      list: {
        useQuery: vi.fn(),
      },
      updateStatus: {
        useMutation: vi.fn(),
      },
      delete: {
        useMutation: vi.fn(),
      },
    },
    todoList: {
      list: {
        invalidate: vi.fn(),
      },
    },
  },
}));

describe("KanbanBoard Component", () => {
  const mockUpdateStatus = vi.fn();
  const mockDelete = vi.fn();
  const mockInvalidate = vi.fn();

  const sampleTasks = [
    {
      id: "123e4567-e89b-42d3-a456-426614174001",
      listId: "list-1",
      title: "Write documentation",
      description: "Document Phase 3 Kanban architecture",
      status: "TODO" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "123e4567-e89b-42d3-a456-426614174002",
      listId: "list-1",
      title: "Implement mobile tabs",
      description: "Touch friendly column navigation",
      status: "IN_PROGRESS" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "123e4567-e89b-42d3-a456-426614174003",
      listId: "list-1",
      title: "Configure Supabase pooler",
      description: null,
      status: "DONE" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(trpc.useUtils).mockReturnValue({
      todo: {
        list: {
          invalidate: mockInvalidate,
        },
      },
      todoList: {
        list: {
          invalidate: mockInvalidate,
        },
      },
    } as unknown as ReturnType<typeof trpc.useUtils>);

    vi.mocked(trpc.todo.updateStatus.useMutation).mockReturnValue({
      mutate: mockUpdateStatus,
      isPending: false,
    } as unknown as ReturnType<typeof trpc.todo.updateStatus.useMutation>);

    vi.mocked(trpc.todo.delete.useMutation).mockReturnValue({
      mutate: mockDelete,
      isPending: false,
    } as unknown as ReturnType<typeof trpc.todo.delete.useMutation>);
  });

  it("should categorize tasks into correct columns based on status", () => {
    vi.mocked(trpc.todo.list.useQuery).mockReturnValue({
      data: sampleTasks,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof trpc.todo.list.useQuery>);

    render(<KanbanBoard listId="list-1" />);

    expect(screen.getByText("Write documentation")).toBeInTheDocument();
    expect(screen.getByText("Implement mobile tabs")).toBeInTheDocument();
    expect(screen.getByText("Configure Supabase pooler")).toBeInTheDocument();
  });

  it("should render global empty state when list has 0 tasks", () => {
    vi.mocked(trpc.todo.list.useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof trpc.todo.list.useQuery>);

    render(<KanbanBoard listId="list-1" />);

    expect(screen.getByText("No tasks in this list yet")).toBeInTheDocument();
  });

  it("should trigger updateStatus mutation when clicking quick-move button from To Do to In Progress", () => {
    vi.mocked(trpc.todo.list.useQuery).mockReturnValue({
      data: [sampleTasks[0]], // only the TODO task
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof trpc.todo.list.useQuery>);

    render(<KanbanBoard listId="list-1" />);

    const moveBtn = screen.getByRole("button", { name: /In Progress/i });
    fireEvent.click(moveBtn);

    expect(mockUpdateStatus).toHaveBeenCalledWith({
      id: sampleTasks[0]?.id,
      status: "IN_PROGRESS",
    });
  });

  it("should trigger updateStatus mutation when moving from In Progress to Done", () => {
    vi.mocked(trpc.todo.list.useQuery).mockReturnValue({
      data: [sampleTasks[1]], // only the IN_PROGRESS task
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof trpc.todo.list.useQuery>);

    render(<KanbanBoard listId="list-1" />);

    const doneBtn = screen.getByRole("button", { name: /Done/i });
    fireEvent.click(doneBtn);

    expect(mockUpdateStatus).toHaveBeenCalledWith({
      id: sampleTasks[1]?.id,
      status: "DONE",
    });
  });

  it("should display error message and retry button when status transition fails", () => {
    let onErrorCallback: ((err: { message: string }, variables: { id: string; status: "IN_PROGRESS" }) => void) | undefined;

    vi.mocked(trpc.todo.updateStatus.useMutation).mockImplementation((opts) => {
      onErrorCallback = opts?.onError as typeof onErrorCallback;
      return {
        mutate: mockUpdateStatus,
        isPending: false,
      } as unknown as ReturnType<typeof trpc.todo.updateStatus.useMutation>;
    });

    vi.mocked(trpc.todo.list.useQuery).mockReturnValue({
      data: [sampleTasks[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof trpc.todo.list.useQuery>);

    render(<KanbanBoard listId="list-1" />);

    expect(onErrorCallback).toBeDefined();

    act(() => {
      onErrorCallback?.(
        { message: "Network connection lost" },
        { id: sampleTasks[0]?.id as string, status: "IN_PROGRESS" }
      );
    });

    expect(screen.getByText("Network connection lost")).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: /Retry/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(mockUpdateStatus).toHaveBeenCalledWith({
      id: sampleTasks[0]?.id,
      status: "IN_PROGRESS",
    });
  });

  it("should trigger delete mutation when clicking card trash button", () => {
    vi.mocked(trpc.todo.list.useQuery).mockReturnValue({
      data: [sampleTasks[0]],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof trpc.todo.list.useQuery>);

    render(<KanbanBoard listId="list-1" />);

    const deleteBtn = screen.getByRole("button", {
      name: new RegExp(`Delete task: ${sampleTasks[0]?.title}`, "i"),
    });
    fireEvent.click(deleteBtn);

    expect(mockDelete).toHaveBeenCalledWith({ id: sampleTasks[0]?.id });
  });
});
