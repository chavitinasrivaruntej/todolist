import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TaskFilterBar, type TaskFilterState } from "@/components/todos/task-filter-bar";

describe("TaskFilterBar", () => {
  const defaultFilters: TaskFilterState = {
    search: "",
    priority: undefined,
    dueFilter: "ALL",
    sortBy: "created",
    sortDirection: "desc",
  };

  it("should render search input, priority filter, due filter, and sort selector", () => {
    render(
      <TaskFilterBar
        filters={defaultFilters}
        onFilterChange={vi.fn()}
        onReset={vi.fn()}
        taskCount={5}
      />
    );

    expect(
      screen.getByPlaceholderText(/Search tasks by title or description/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Filter by priority/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Filter by due date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sort tasks by/i)).toBeInTheDocument();
    expect(screen.getByText(/Showing 5 tasks/i)).toBeInTheDocument();
  });

  it("should trigger onFilterChange when search text is typed", () => {
    const handleFilterChange = vi.fn();
    render(
      <TaskFilterBar
        filters={defaultFilters}
        onFilterChange={handleFilterChange}
        onReset={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search tasks by title or description/i);
    fireEvent.change(searchInput, { target: { value: "meeting" } });

    expect(handleFilterChange).toHaveBeenCalledWith({ search: "meeting" });
  });

  it("should trigger onFilterChange when priority is selected", () => {
    const handleFilterChange = vi.fn();
    render(
      <TaskFilterBar
        filters={defaultFilters}
        onFilterChange={handleFilterChange}
        onReset={vi.fn()}
      />
    );

    const prioritySelect = screen.getByLabelText(/Filter by priority/i);
    fireEvent.change(prioritySelect, { target: { value: "URGENT" } });

    expect(handleFilterChange).toHaveBeenCalledWith({ priority: "URGENT" });
  });

  it("should display reset filters button and trigger onReset when active filters exist", () => {
    const handleReset = vi.fn();
    render(
      <TaskFilterBar
        filters={{
          ...defaultFilters,
          search: "test",
        }}
        onFilterChange={vi.fn()}
        onReset={handleReset}
      />
    );

    const resetButton = screen.getByRole("button", { name: /Reset filters/i });
    expect(resetButton).toBeInTheDocument();

    fireEvent.click(resetButton);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });
});

