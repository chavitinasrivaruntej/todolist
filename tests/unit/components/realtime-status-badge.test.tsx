import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RealtimeStatusBadge } from "@/components/realtime/realtime-status-badge";

describe("RealtimeStatusBadge Component", () => {
  it("should render nothing when status is IDLE", () => {
    const { container } = render(<RealtimeStatusBadge status="IDLE" />);
    expect(container.firstChild).toBeNull();
  });

  it("should render Live when status is CONNECTED", () => {
    render(<RealtimeStatusBadge status="CONNECTED" />);
    expect(screen.getByText("Live")).toBeDefined();
    expect(screen.getByLabelText("Realtime status: Live sync active")).toBeDefined();
  });

  it("should render Connecting when status is CONNECTING", () => {
    render(<RealtimeStatusBadge status="CONNECTING" />);
    expect(screen.getByText("Connecting...")).toBeDefined();
    expect(screen.getByLabelText("Realtime status: Connecting...")).toBeDefined();
  });

  it("should render Reconnecting when status is DISCONNECTED", () => {
    render(<RealtimeStatusBadge status="DISCONNECTED" />);
    expect(screen.getByText("Reconnecting...")).toBeDefined();
  });

  it("should render Realtime unavailable when status is UNAVAILABLE", () => {
    render(<RealtimeStatusBadge status="UNAVAILABLE" />);
    expect(screen.getByText("Realtime unavailable")).toBeDefined();
  });
});
