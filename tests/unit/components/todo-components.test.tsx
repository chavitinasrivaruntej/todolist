import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TodoForm } from "@/components/todos/todo-form";
import { TodoItem, type TodoListItem } from "@/components/todos/todo-item";
import { trpc } from "@/lib/trpc/client";

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    useUtils: vi.fn(),
    todo: {
      create: {
        useMutation: vi.fn(),
      },
      delete: {
        useMutation: vi.fn(),
      },
      updateStatus: {
        useMutation: vi.fn(),
      },
      list: {
        useQuery: vi.fn(),
      },
    },
    todoList: {
      list: {
        useQuery: vi.fn(),
        invalidate: vi.fn(),
      },
    },
  },
}));

describe("UI Components", () => {
  const mockMutate = vi.fn();
  const mockStatusMutate = vi.fn();
  const mockInvalidate = vi.fn();

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
      mutate: mockStatusMutate,
      isPending: false,
    } as unknown as ReturnType<typeof trpc.todo.updateStatus.useMutation>);
  });

  describe("TodoForm", () => {
    it("should render title and description input fields", () => {
      vi.mocked(trpc.todo.create.useMutation).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as unknown as ReturnType<typeof trpc.todo.create.useMutation>);

      render(<TodoForm listId="list-123" listName="College" />);

      expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Add Task/i })).toBeInTheDocument();
    });

    it("should disable submit button when title is empty", () => {
      vi.mocked(trpc.todo.create.useMutation).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as unknown as ReturnType<typeof trpc.todo.create.useMutation>);

      render(<TodoForm listId="list-123" listName="College" />);

      const submitButton = screen.getByRole("button", { name: /Add Task/i });
      expect(submitButton).toBeDisabled();
    });

    it("should enable submit button and call mutation when title is entered", () => {
      vi.mocked(trpc.todo.create.useMutation).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as unknown as ReturnType<typeof trpc.todo.create.useMutation>);

      render(<TodoForm listId="list-123" listName="College" />);

      const titleInput = screen.getByLabelText(/Title/i);
      fireEvent.change(titleInput, { target: { value: "Implement testing" } });

      const submitButton = screen.getByRole("button", { name: /Add Task/i });
      expect(submitButton).not.toBeDisabled();

      fireEvent.click(submitButton);

      expect(mockMutate).toHaveBeenCalledWith({
        listId: "list-123",
        title: "Implement testing",
        description: undefined,
        status: "TODO",
      });
    });
  });

  describe("TodoItem", () => {
    const sampleTodo: TodoListItem = {
      id: "123e4567-e89b-42d3-a456-426614174000",
      listId: "list-123",
      title: "UI Card Task",
      description: "Optional notes here",
      status: "TODO" as const,
      createdAt: new Date("2026-05-01T12:00:00Z").toISOString(),
      updatedAt: new Date("2026-05-01T12:00:00Z").toISOString(),
    };

    it("should display title, description, and delete button", () => {
      vi.mocked(trpc.todo.delete.useMutation).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as unknown as ReturnType<typeof trpc.todo.delete.useMutation>);

      render(<TodoItem todo={sampleTodo} listId="list-123" />);

      expect(screen.getByText("UI Card Task")).toBeInTheDocument();
      expect(screen.getByText("Optional notes here")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Delete todo: UI Card Task/i })
      ).toBeInTheDocument();
    });

    it("should trigger delete mutation when delete button is clicked", () => {
      vi.mocked(trpc.todo.delete.useMutation).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as unknown as ReturnType<typeof trpc.todo.delete.useMutation>);

      render(<TodoItem todo={sampleTodo} listId="list-123" />);

      const deleteButton = screen.getByRole("button", {
        name: /Delete todo: UI Card Task/i,
      });
      fireEvent.click(deleteButton);

      expect(mockMutate).toHaveBeenCalledWith({ id: sampleTodo.id });
    });

    it("should trigger updateStatus mutation when status select changes", () => {
      vi.mocked(trpc.todo.delete.useMutation).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as unknown as ReturnType<typeof trpc.todo.delete.useMutation>);

      render(<TodoItem todo={sampleTodo} listId="list-123" />);

      const select = screen.getByLabelText(/Change status for UI Card Task/i);
      fireEvent.change(select, { target: { value: "DONE" } });

      expect(mockStatusMutate).toHaveBeenCalledWith({
        id: sampleTodo.id,
        status: "DONE",
      });
    });

    it("should render error message and retry button when deletion mutation fails", () => {
      let onErrorCallback: ((err: { message: string }) => void) | undefined;

      vi.mocked(trpc.todo.delete.useMutation).mockImplementation((opts) => {
        onErrorCallback = opts?.onError as typeof onErrorCallback;
        return {
          mutate: mockMutate,
          isPending: false,
        } as unknown as ReturnType<typeof trpc.todo.delete.useMutation>;
      });

      render(<TodoItem todo={sampleTodo} listId="list-123" />);

      expect(onErrorCallback).toBeDefined();
      act(() => {
        onErrorCallback?.({ message: "Network connection lost" });
      });

      expect(screen.getByText("Network connection lost")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    });
  });
});
