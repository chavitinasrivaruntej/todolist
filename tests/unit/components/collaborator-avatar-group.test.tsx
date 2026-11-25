import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CollaboratorAvatarGroup } from "@/components/realtime/collaborator-avatar-group";
import type { UniqueCollaborator } from "@/hooks/use-realtime-board";

describe("CollaboratorAvatarGroup Component", () => {
  it("should render nothing when collaborators array is empty", () => {
    const { container } = render(
      <CollaboratorAvatarGroup collaborators={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render avatar initials for active collaborators", () => {
    const collaborators: UniqueCollaborator[] = [
      {
        userId: "user-1",
        displayName: "Alice Smith",
        role: "OWNER",
        activeView: "board",
        sessionCount: 1,
      },
      {
        userId: "user-2",
        displayName: "Bob Jones",
        role: "EDITOR",
        activeView: "list",
        sessionCount: 2,
      },
    ];

    render(
      <CollaboratorAvatarGroup
        collaborators={collaborators}
        currentUserId="user-1"
      />
    );

    // Initial checks: Alice Smith -> AS, Bob Jones -> BJ
    expect(screen.getByText("AS")).toBeDefined();
    expect(screen.getByText("BJ")).toBeDefined();

    // Multi-tab indicator: Bob has 2 tabs
    expect(screen.getByText("2")).toBeDefined();
  });

  it("should display overflow indicator when more than 4 collaborators are present", () => {
    const collaborators: UniqueCollaborator[] = Array.from({ length: 6 }, (_, i) => ({
      userId: `user-${i + 1}`,
      displayName: `User ${i + 1}`,
      role: "VIEWER" as const,
      activeView: "list" as const,
      sessionCount: 1,
    }));

    render(<CollaboratorAvatarGroup collaborators={collaborators} />);

    // First 4 visible, remaining 2 indicated by "+2"
    expect(screen.getByText("+2")).toBeDefined();
  });

  it("should render accessible empty state when showEmptyState is true and collaborators array is empty", () => {
    render(<CollaboratorAvatarGroup collaborators={[]} showEmptyState={true} />);
    expect(screen.getByText("No other collaborators")).toBeDefined();
  });

  it("should provide keyboard focusable avatars with accessible labels", () => {
    const collaborators: UniqueCollaborator[] = [
      {
        userId: "user-1",
        displayName: "Alice",
        role: "OWNER",
        activeView: "board",
        sessionCount: 2,
      },
    ];

    render(<CollaboratorAvatarGroup collaborators={collaborators} currentUserId="user-1" />);
    const avatar = screen.getByRole("img", { name: /Alice \(OWNER\) - You • 2 active tabs/i });
    expect(avatar).toBeDefined();
    expect(avatar.getAttribute("tabIndex")).toBe("0");
  });
});
