import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InvitationAcceptCard } from "@/components/sharing/invitation-accept-card";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// Mock tRPC client
vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    useUtils: vi.fn(),
    invitation: {
      inspect: {
        useQuery: vi.fn(),
      },
      accept: {
        useMutation: vi.fn(),
      },
    },
  },
}));

// Mock Supabase client
const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
    },
  }),
}));

describe("InvitationAcceptCard Component", () => {
  const token = "30816cea951ba2ade423890970244e80";
  const mockMutate = vi.fn();

  const mockInviteData = {
    listId: "list-111",
    listName: "Architecture Roadmap",
    inviterEmail: "owner@example.com",
    role: "EDITOR" as const,
    targetEmail: "colleague@example.com",
    expiresAt: new Date(Date.now() + 86400000),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(trpc.invitation.accept.useMutation).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof trpc.invitation.accept.useMutation>);
  });

  it("should render loading state while verifying session and token", () => {
    mockGetUser.mockReturnValue(new Promise(() => {})); // pending
    vi.mocked(trpc.invitation.inspect.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof trpc.invitation.inspect.useQuery>);

    render(<InvitationAcceptCard token={token} />);

    expect(screen.getByText(/Verifying invitation link\.\.\./i)).toBeInTheDocument();
  });

  it("should render invalid/expired card when inspection fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    vi.mocked(trpc.invitation.inspect.useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: "This invitation link is invalid or has expired." },
    } as unknown as ReturnType<typeof trpc.invitation.inspect.useQuery>);

    render(<InvitationAcceptCard token={token} />);

    await waitFor(() => {
      expect(screen.getByText(/Invalid or Expired Invitation/i)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/This invitation link is invalid or has expired\./i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to Dashboard/i })).toBeInTheDocument();
  });

  it("should render unauthenticated state with Sign In and Sign Up buttons preserving redirect", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    vi.mocked(trpc.invitation.inspect.useQuery).mockReturnValue({
      data: mockInviteData,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof trpc.invitation.inspect.useQuery>);

    render(<InvitationAcceptCard token={token} />);

    await waitFor(() => {
      expect(screen.getByText("Architecture Roadmap")).toBeInTheDocument();
    });

    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("colleague@example.com").length).toBeGreaterThanOrEqual(1);

    // Verify Sign In and Sign Up links preserve token redirect parameter
    const signInLink = screen.getByRole("link", { name: /Sign In/i });
    expect(signInLink).toHaveAttribute(
      "href",
      `/login?redirect=${encodeURIComponent(`/invite/${token}`)}`
    );

    const signUpLink = screen.getByRole("link", { name: /Sign Up/i });
    expect(signUpLink).toHaveAttribute(
      "href",
      `/register?redirect=${encodeURIComponent(`/invite/${token}`)}`
    );
  });

  it("should render account mismatch UI when signed in user email differs from invited email", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "other-user@example.com" } },
    });
    vi.mocked(trpc.invitation.inspect.useQuery).mockReturnValue({
      data: mockInviteData,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof trpc.invitation.inspect.useQuery>);

    render(<InvitationAcceptCard token={token} />);

    await waitFor(() => {
      expect(screen.getByText(/Account mismatch/i)).toBeInTheDocument();
    });

    expect(screen.getByText("other-user@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Sign Out & Switch Account/i })
    ).toBeInTheDocument();
    // Accept button must NOT be present
    expect(
      screen.queryByRole("button", { name: /Accept Invitation & Join List/i })
    ).not.toBeInTheDocument();

    // Clicking switch account triggers sign out and redirects to login with invite preserved
    fireEvent.click(
      screen.getByRole("button", { name: /Sign Out & Switch Account/i })
    );

    expect(mockSignOut).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        `/login?redirect=${encodeURIComponent(`/invite/${token}`)}`
      );
    });
  });

  it("should render accept button when authenticated email matches invited email", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "colleague@example.com" } },
    });
    vi.mocked(trpc.invitation.inspect.useQuery).mockReturnValue({
      data: mockInviteData,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof trpc.invitation.inspect.useQuery>);

    render(<InvitationAcceptCard token={token} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Signed in as verified invitee: colleague@example.com/i)
      ).toBeInTheDocument();
    });

    const acceptBtn = screen.getByRole("button", {
      name: /Accept Invitation & Join List/i,
    });
    expect(acceptBtn).toBeInTheDocument();

    fireEvent.click(acceptBtn);
    expect(mockMutate).toHaveBeenCalledWith({ token });
  });
});

