import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "@/server/api/root";
import { invitationService } from "@/server/services/invitation.service";
import { todoListService } from "@/server/services/todo-list.service";
import { listPermissionService } from "@/server/services/list-permission.service";
import { listMemberRepository } from "@/server/repositories/list-member.repository";
import { todoListRepository } from "@/server/repositories/todo-list.repository";
import { invitationRepository } from "@/server/repositories/invitation.repository";
import type { User } from "@supabase/supabase-js";
import { db } from "@/db";

describe("tRPC API: Sharing and Invitation Routers", () => {
  const mockUser: User = {
    id: "user-1234-abcd",
    email: "owner@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const createCaller = (user: User | null = mockUser) =>
    appRouter.createCaller({
      headers: undefined,
      user,
    });

  const listId = "123e4567-e89b-42d3-a456-426614174001";
  const memberId = "123e4567-e89b-42d3-a456-426614174002";
  const invitationId = "123e4567-e89b-42d3-a456-426614174003";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("sharing.invite", () => {
    it("should reject unauthenticated request with UNAUTHORIZED", async () => {
      const caller = createCaller(null);
      await expect(
        caller.sharing.invite({
          listId,
          email: "colleague@example.com",
          role: "EDITOR",
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("should call invitationService.createInvitation with session email and caller id", async () => {
      vi.spyOn(invitationService, "createInvitation").mockResolvedValue({
        success: true,
        invitationId,
        invitationUrl: "http://localhost:3000/invite/test-token",
      });

      const caller = createCaller();
      const res = await caller.sharing.invite({
        listId,
        email: "colleague@example.com",
        role: "EDITOR",
      });

      expect(res.success).toBe(true);
      expect(invitationService.createInvitation).toHaveBeenCalledWith(
        { listId, email: "colleague@example.com", role: "EDITOR" },
        mockUser.id,
        mockUser.email
      );
    });
  });

  describe("sharing.updateRole", () => {
    it("should update role after verifying owner permission", async () => {
      vi.spyOn(listMemberRepository, "findById").mockResolvedValue({
        id: memberId,
        listId,
        userId: "colleague-uuid",
        role: "VIEWER",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.spyOn(listPermissionService, "requireOwner").mockResolvedValue(undefined);
      vi.spyOn(listMemberRepository, "updateRole").mockResolvedValue({
        id: memberId,
        listId,
        userId: "colleague-uuid",
        role: "EDITOR",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const caller = createCaller();
      const res = await caller.sharing.updateRole({
        memberId,
        role: "EDITOR",
      });

      expect(listMemberRepository.findById).toHaveBeenCalledWith(memberId);
      expect(listPermissionService.requireOwner).toHaveBeenCalledWith(mockUser.id, listId);
      expect(listMemberRepository.updateRole).toHaveBeenCalledWith(memberId, "EDITOR");
      expect(res.role).toBe("EDITOR");
    });
  });

  describe("sharing.removeMember", () => {
    it("should remove collaborator after verifying owner permission", async () => {
      vi.spyOn(listMemberRepository, "findById").mockResolvedValue({
        id: memberId,
        listId,
        userId: "colleague-uuid",
        role: "EDITOR",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.spyOn(listPermissionService, "requireOwner").mockResolvedValue(undefined);
      vi.spyOn(listMemberRepository, "deleteMember").mockResolvedValue(true);

      const caller = createCaller();
      const res = await caller.sharing.removeMember({ memberId });

      expect(res).toEqual({ success: true, memberId });
      expect(listPermissionService.requireOwner).toHaveBeenCalledWith(mockUser.id, listId);
      expect(listMemberRepository.deleteMember).toHaveBeenCalledWith(memberId);
    });
  });

  describe("sharing.leaveList", () => {
    it("should invoke todoListService.leaveList", async () => {
      vi.spyOn(todoListService, "leaveList").mockResolvedValue({
        success: true,
        listId,
      });

      const caller = createCaller();
      const res = await caller.sharing.leaveList({ listId });

      expect(res).toEqual({ success: true, listId });
      expect(todoListService.leaveList).toHaveBeenCalledWith({ listId }, mockUser.id);
    });
  });

  describe("invitation.inspect", () => {
    it("should allow public inspection of an invitation token", async () => {
      vi.spyOn(invitationService, "inspectInvitation").mockResolvedValue({
        listId,
        listName: "Architecture Review",
        inviterEmail: "owner@example.com",
        role: "EDITOR",
        targetEmail: "invitee@example.com",
        expiresAt: new Date(),
      });

      const caller = createCaller(null); // Unauthenticated caller
      const res = await caller.invitation.inspect({ token: "test-token" });

      expect(res.listName).toBe("Architecture Review");
      expect(res.role).toBe("EDITOR");
      expect(invitationService.inspectInvitation).toHaveBeenCalledWith("test-token");
    });
  });

  describe("invitation.accept", () => {
    it("should require authentication to accept invitation", async () => {
      const caller = createCaller(null);
      await expect(
        caller.invitation.accept({ token: "test-token" })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("should call invitationService.acceptInvitation with verified session email", async () => {
      vi.spyOn(invitationService, "acceptInvitation").mockResolvedValue({
        success: true,
        listId,
        listName: "Architecture Review",
      });

      const caller = createCaller();
      const res = await caller.invitation.accept({ token: "test-token" });

      expect(res.success).toBe(true);
      expect(invitationService.acceptInvitation).toHaveBeenCalledWith(
        "test-token",
        mockUser.id,
        mockUser.email
      );
    });
  });
});

