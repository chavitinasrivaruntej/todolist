import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "@/server/api/root";
import { attachmentService } from "@/server/services/attachment.service";
import type { User } from "@supabase/supabase-js";
import { type TodoAttachment } from "@/db/schema/attachments";

describe("tRPC API: Attachment Router", () => {
  const mockUser: User = {
    id: "user-1234-abcd",
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

  const sampleTodoId = "123e4567-e89b-42d3-a456-426614174001";
  const sampleAttachmentId = "123e4567-e89b-42d3-a456-426614174999";
  const sampleListId = "123e4567-e89b-42d3-a456-426614174000";

  const sampleAttachment: TodoAttachment = {
    id: sampleAttachmentId,
    todoId: sampleTodoId,
    listId: sampleListId,
    storagePath: `lists/${sampleListId}/todos/${sampleTodoId}/random-file.pdf`,
    originalFilename: "specs.pdf",
    sanitizedFilename: "specs.pdf",
    mimeType: "application/pdf",
    fileSize: 1024 * 50,
    status: "ACTIVE",
    expiresAt: null,
    deletedAt: null,
    uploadedBy: mockUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should reject unauthenticated caller with UNAUTHORIZED", async () => {
    const unauthedCaller = createCaller(null);
    await expect(
      unauthedCaller.attachment.getByTodo({ todoId: sampleTodoId })
    ).rejects.toThrow("You must be logged in to perform this action.");
  });

  describe("attachment.createUploadUrl", () => {
    it("should call attachmentService.createUploadAuthorization and return upload credentials", async () => {
      const mockResult = {
        attachmentId: sampleAttachmentId,
        uploadUrl: "https://storage.supabase.co/upload?token=test",
        token: "test",
        storagePath: sampleAttachment.storagePath,
        expiresIn: 120,
      };

      vi.spyOn(attachmentService, "createUploadAuthorization").mockResolvedValue(mockResult);

      const caller = createCaller(mockUser);
      const res = await caller.attachment.createUploadUrl({
        todoId: sampleTodoId,
        filename: "specs.pdf",
        mimeType: "application/pdf",
        fileSize: 1024 * 50,
      });

      expect(res).toEqual(mockResult);
      expect(attachmentService.createUploadAuthorization).toHaveBeenCalledWith(
        {
          todoId: sampleTodoId,
          filename: "specs.pdf",
          mimeType: "application/pdf",
          fileSize: 1024 * 50,
        },
        mockUser.id
      );
    });
  });

  describe("attachment.confirmUpload", () => {
    it("should call attachmentService.confirmUploadedAttachment and return active record", async () => {
      vi.spyOn(attachmentService, "confirmUploadedAttachment").mockResolvedValue(sampleAttachment);

      const caller = createCaller(mockUser);
      const res = await caller.attachment.confirmUpload({
        attachmentId: sampleAttachmentId,
      });

      expect(res).toEqual(sampleAttachment);
      expect(attachmentService.confirmUploadedAttachment).toHaveBeenCalledWith(
        { attachmentId: sampleAttachmentId },
        mockUser.id
      );
    });
  });

  describe("attachment.getByTodo", () => {
    it("should call attachmentService.getAttachmentsByTodo and return active attachments", async () => {
      vi.spyOn(attachmentService, "getAttachmentsByTodo").mockResolvedValue([sampleAttachment]);

      const caller = createCaller(mockUser);
      const res = await caller.attachment.getByTodo({
        todoId: sampleTodoId,
      });

      expect(res).toEqual([sampleAttachment]);
      expect(attachmentService.getAttachmentsByTodo).toHaveBeenCalledWith(
        sampleTodoId,
        mockUser.id
      );
    });
  });

  describe("attachment.createDownloadUrl", () => {
    it("should call attachmentService.createDownloadAuthorization and return signed download URL", async () => {
      const mockDownload = {
        downloadUrl: "https://storage.supabase.co/download?token=signed",
        filename: "specs.pdf",
        mimeType: "application/pdf",
        expiresIn: 300,
      };

      vi.spyOn(attachmentService, "createDownloadAuthorization").mockResolvedValue(mockDownload);

      const caller = createCaller(mockUser);
      const res = await caller.attachment.createDownloadUrl({
        attachmentId: sampleAttachmentId,
      });

      expect(res).toEqual(mockDownload);
      expect(attachmentService.createDownloadAuthorization).toHaveBeenCalledWith(
        { attachmentId: sampleAttachmentId },
        mockUser.id
      );
    });
  });

  describe("attachment.delete", () => {
    it("should call attachmentService.deleteAttachment and return success confirmation", async () => {
      vi.spyOn(attachmentService, "deleteAttachment").mockResolvedValue({
        success: true,
        id: sampleAttachmentId,
      });

      const caller = createCaller(mockUser);
      const res = await caller.attachment.delete({
        attachmentId: sampleAttachmentId,
      });

      expect(res).toEqual({
        success: true,
        id: sampleAttachmentId,
      });
      expect(attachmentService.deleteAttachment).toHaveBeenCalledWith(
        { attachmentId: sampleAttachmentId },
        mockUser.id
      );
    });
  });
});
