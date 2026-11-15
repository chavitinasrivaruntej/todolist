import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { PriorityBadge, DueDateBadge } from "@/components/todos/task-meta-badges";

describe("task-meta-badges", () => {
  describe("PriorityBadge", () => {
    it("should render URGENT priority with high-visibility red styling", () => {
      render(<PriorityBadge priority="URGENT" />);
      const badge = screen.getByText("URGENT");
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain("text-red-700");
    });

    it("should render HIGH, MEDIUM, and LOW priority levels cleanly", () => {
      const { rerender } = render(<PriorityBadge priority="HIGH" />);
      expect(screen.getByText("HIGH")).toBeInTheDocument();

      rerender(<PriorityBadge priority="MEDIUM" />);
      expect(screen.getByText("MEDIUM")).toBeInTheDocument();

      rerender(<PriorityBadge priority="LOW" />);
      expect(screen.getByText("LOW")).toBeInTheDocument();
    });
  });

  describe("DueDateBadge", () => {
    const referenceToday = "2026-11-15";

    it("should render null when dueDate is not set", () => {
      const { container } = render(
        <DueDateBadge dueDate={null} status="TODO" clientToday={referenceToday} />
      );
      expect(container.firstChild).toBeNull();
    });

    it("should display overdue badge with alert icon when status is TODO and dueDate is past", () => {
      render(
        <DueDateBadge
          dueDate="2026-11-10"
          status="TODO"
          clientToday={referenceToday}
        />
      );
      expect(screen.getByText(/Overdue \(Nov 10, 2026\)/i)).toBeInTheDocument();
    });

    it("should display overdue badge when status is IN_PROGRESS and dueDate is past", () => {
      render(
        <DueDateBadge
          dueDate="2026-11-10"
          status="IN_PROGRESS"
          clientToday={referenceToday}
        />
      );
      expect(screen.getByText(/Overdue \(Nov 10, 2026\)/i)).toBeInTheDocument();
    });

    it("should NEVER display overdue badge when status is DONE, even if past", () => {
      render(
        <DueDateBadge
          dueDate="2026-11-10"
          status="DONE"
          clientToday={referenceToday}
        />
      );
      expect(screen.queryByText(/Overdue/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Due Nov 10, 2026/i)).toBeInTheDocument();
    });

    it("should display 'Due today' badge when dueDate matches clientToday", () => {
      render(
        <DueDateBadge
          dueDate={referenceToday}
          status="TODO"
          clientToday={referenceToday}
        />
      );
      expect(screen.getByText(/Due today/i)).toBeInTheDocument();
    });

    it("should display standard upcoming due date when in future", () => {
      render(
        <DueDateBadge
          dueDate="2026-11-20"
          status="TODO"
          clientToday={referenceToday}
        />
      );
      expect(screen.getByText(/Due Nov 20, 2026/i)).toBeInTheDocument();
      expect(screen.queryByText(/Overdue/i)).not.toBeInTheDocument();
    });
  });
});

