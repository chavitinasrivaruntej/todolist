import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ListSidebar } from "@/components/lists/list-sidebar";
import { trpc } from "@/lib/trpc/client";

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    useUtils: vi.fn(),
    todoList: {
      list: {
        useQuery: vi.fn(),
      },
      create: {
        useMutation: vi.fn(),
      },
      rename: {
        useMutation: vi.fn(),
      },
      delete: {
        useMutation: vi.fn(),
      },
    },
  },
}));

describe("ListSidebar Component", () => {
  const mockCreateMutate = vi.fn();
  const mockRenameMutate = vi.fn();
  const mockDeleteMutate = vi.fn();
  const mockInvalidate = vi.fn();
  const mockOnSelectList = vi.fn();

  const sampleLists = [
    {
      id: "list-1",
      name: "Personal",
      taskCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "list-2",
      name: "Projects",
      taskCount: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(trpc.useUtils).mockReturnValue({
      todoList: {
        list: {
          invalidate: mockInvalidate,
        },
      },
    } as unknown as ReturnType<typeof trpc.useUtils>);

    vi.mocked(trpc.todoList.create.useMutation).mockReturnValue({
      mutate: mockCreateMutate,
      isPending: false,
    } as unknown as ReturnType<typeof trpc.todoList.create.useMutation>);

    vi.mocked(trpc.todoList.rename.useMutation).mockReturnValue({
      mutate: mockRenameMutate,
      isPending: false,
    } as unknown as ReturnType<typeof trpc.todoList.rename.useMutation>);

    vi.mocked(trpc.todoList.delete.useMutation).mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof trpc.todoList.delete.useMutation>);
  });

  it("should render lists with their names and task count badges", () => {
    vi.mocked(trpc.todoList.list.useQuery).mockReturnValue({
      data: sampleLists,
      isLoading: false,
    } as unknown as ReturnType<typeof trpc.todoList.list.useQuery>);

    render(
      <ListSidebar
        selectedListId="list-1"
        onSelectList={mockOnSelectList}
      />
    );

    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("should call onSelectList when a list item is clicked", () => {
    vi.mocked(trpc.todoList.list.useQuery).mockReturnValue({
      data: sampleLists,
      isLoading: false,
    } as unknown as ReturnType<typeof trpc.todoList.list.useQuery>);

    render(
      <ListSidebar
        selectedListId="list-1"
        onSelectList={mockOnSelectList}
      />
    );

    fireEvent.click(screen.getByText("Projects"));
    expect(mockOnSelectList).toHaveBeenCalledWith("list-2");
  });

  it("should toggle inline form and create a new list", () => {
    vi.mocked(trpc.todoList.list.useQuery).mockReturnValue({
      data: sampleLists,
      isLoading: false,
    } as unknown as ReturnType<typeof trpc.todoList.list.useQuery>);

    render(
      <ListSidebar
        selectedListId="list-1"
        onSelectList={mockOnSelectList}
      />
    );

    const newBtn = screen.getByRole("button", { name: /Create New List/i });
    fireEvent.click(newBtn);

    const input = screen.getByPlaceholderText(/e\.g\. College, Habits\.\.\./i);
    fireEvent.change(input, { target: { value: "Habits" } });

    const createBtn = screen.getByRole("button", { name: "Create" });
    fireEvent.click(createBtn);

    expect(mockCreateMutate).toHaveBeenCalledWith({ name: "Habits" });
  });

  it("should delete empty list immediately with force=false", () => {
    vi.mocked(trpc.todoList.list.useQuery).mockReturnValue({
      data: sampleLists,
      isLoading: false,
    } as unknown as ReturnType<typeof trpc.todoList.list.useQuery>);

    render(
      <ListSidebar
        selectedListId="list-1"
        onSelectList={mockOnSelectList}
      />
    );

    const deleteBtn = screen.getByRole("button", { name: /Delete list Personal/i });
    fireEvent.click(deleteBtn);

    expect(mockDeleteMutate).toHaveBeenCalledWith({ id: "list-1", force: false });
  });

  it("should prompt confirmation warning when deleting a list with tasks and require force=true", () => {
    vi.mocked(trpc.todoList.list.useQuery).mockReturnValue({
      data: sampleLists,
      isLoading: false,
    } as unknown as ReturnType<typeof trpc.todoList.list.useQuery>);

    render(
      <ListSidebar
        selectedListId="list-2"
        onSelectList={mockOnSelectList}
      />
    );

    const deleteBtn = screen.getByRole("button", { name: /Delete list Projects/i });
    fireEvent.click(deleteBtn);

    // Confirmation warning modal should appear
    expect(screen.getByText(/Delete "Projects"\?/i)).toBeInTheDocument();
    expect(screen.getByText(/This list contains 3 task\(s\)\./i)).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole("button", { name: /Delete All/i });
    fireEvent.click(confirmDeleteBtn);

    expect(mockDeleteMutate).toHaveBeenCalledWith({ id: "list-2", force: true });
  });
});
