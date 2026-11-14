import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TodoForm } from "@/components/todos/todo-form";
import { TodoItem } from "@/components/todos/todo-item";
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
      list: {
        useQuery: vi.fn(),
      },
    },
  },
}));

describe("UI Components", () => {
  const mockMutate = vi.fn();
  const mockInvalidate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(trpc.useUtils).mockReturnValue({
      todo: {
        list: {
          invalidate: mockInvalidate,
        },
      },
    } as unknown as ReturnType<typeof trpc.useUtils>);
  });

  describe("TodoForm", () => {
    it("should render title and description input fields", () => {
      vi.mocked(trpc.todo.create.useMutation).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as unknown as ReturnType<typeof trpc.todo.create.useMutation>);

      render(<TodoForm />);

      expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Add Todo/i })).toBeInTheDocument();
    });

    it("should disable submit button when title is empty", () => {
      vi.mocked(trpc.todo.create.useMutation).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as unknown as ReturnType<typeof trpc.todo.create.useMutation>);

      render(<TodoForm />);

      const submitButton = screen.getByRole("button", { name: /Add Todo/i });
      expect(submitButton).toBeDisabled();
    });

    it("should enable submit button and call mutation when title is entered", () => {
      vi.mocked(trpc.todo.create.useMutation).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as unknown as ReturnType<typeof trpc.todo.create.useMutation>);

      render(<TodoForm />);

      const titleInput = screen.getByLabelText(/Title/i);
      fireEvent.change(titleInput, { target: { value: "Implement testing" } });

      const submitButton = screen.getByRole("button", { name: /Add Todo/i });
      expect(submitButton).not.toBeDisabled();

      fireEvent.click(submitButton);

      expect(mockMutate).toHaveBeenCalledWith({
        title: "Implement testing",
        description: undefined,
      });
    });
  });

  describe("TodoItem", () => {
    const sampleTodo = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      title: "UI Card Task",
      description: "Optional notes here",
      createdAt: new Date("2026-05-01T12:00:00Z").toISOString(),
      updatedAt: new Date("2026-05-01T12:00:00Z").toISOString(),
    };

    it("should display title, description, and delete button", () => {
      vi.mocked(trpc.todo.delete.useMutation).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as unknown as ReturnType<typeof trpc.todo.delete.useMutation>);

      render(<TodoItem todo={sampleTodo} />);

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

      render(<TodoItem todo={sampleTodo} />);

      const deleteButton = screen.getByRole("button", {
        name: /Delete todo: UI Card Task/i,
      });
      fireEvent.click(deleteButton);

      expect(mockMutate).toHaveBeenCalledWith({ id: sampleTodo.id });
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

      render(<TodoItem todo={sampleTodo} />);

      // Simulate deletion error callback inside act
      expect(onErrorCallback).toBeDefined();
      act(() => {
        onErrorCallback?.({ message: "Network connection lost" });
      });

      expect(screen.getByText("Network connection lost")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    });
  });
});
