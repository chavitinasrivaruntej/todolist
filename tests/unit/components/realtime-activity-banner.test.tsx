import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RealtimeActivityBanner } from "@/components/realtime/realtime-activity-banner";
import type { RealtimeActivityNotification } from "@/hooks/use-realtime-board";

describe("RealtimeActivityBanner Component", () => {
  it("should render null when activity is null", () => {
    const { container } = render(
      <RealtimeActivityBanner activity={null} onDismiss={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render activity message and icon when activity is present", () => {
    const activity: RealtimeActivityNotification = {
      id: "act-1",
      type: "TASK_CREATED",
      message: 'Task "New Feature" created',
      timestamp: Date.now(),
    };

    render(<RealtimeActivityBanner activity={activity} onDismiss={vi.fn()} />);

    expect(screen.getByText('Task "New Feature" created')).toBeDefined();
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("should trigger onDismiss when dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    const activity: RealtimeActivityNotification = {
      id: "act-2",
      type: "COLLABORATOR_JOINED",
      message: "Alice joined the list",
      timestamp: Date.now(),
    };

    render(<RealtimeActivityBanner activity={activity} onDismiss={onDismiss} />);

    const button = screen.getByLabelText("Dismiss activity notification");
    fireEvent.click(button);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
