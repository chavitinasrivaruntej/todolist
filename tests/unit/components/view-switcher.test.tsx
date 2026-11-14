import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewSwitcher } from "@/components/todos/view-switcher";

describe("ViewSwitcher Component", () => {
  it("should render List and Board buttons with correct active state", () => {
    const handleViewChange = vi.fn();

    const { rerender } = render(
      <ViewSwitcher currentView="list" onViewChange={handleViewChange} />
    );

    const listBtn = screen.getByRole("button", { name: /List/i });
    const boardBtn = screen.getByRole("button", { name: /Board/i });

    expect(listBtn).toHaveAttribute("aria-pressed", "true");
    expect(boardBtn).toHaveAttribute("aria-pressed", "false");

    // Rerender with board active
    rerender(<ViewSwitcher currentView="board" onViewChange={handleViewChange} />);
    expect(listBtn).toHaveAttribute("aria-pressed", "false");
    expect(boardBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("should trigger onViewChange callback when clicking buttons", () => {
    const handleViewChange = vi.fn();

    render(<ViewSwitcher currentView="list" onViewChange={handleViewChange} />);

    const boardBtn = screen.getByRole("button", { name: /Board/i });
    fireEvent.click(boardBtn);

    expect(handleViewChange).toHaveBeenCalledWith("board");
  });
});

