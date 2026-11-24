import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { AttachmentService } from "@/server/services/attachment.service";
import { type IAttachmentRepository } from "@/server/repositories/attachment.repository";
import { type ITodoRepository } from "@/server/repositories/todo.repository";
import { ListPermissionService } from "@/server/services/list-permission.service";
import { ActivityService } from "@/server/services/activity.service";
import { type ISupabaseStorageAdapter } from "@/lib/storage/supabase-storage";
import { type Database } from "@/db";
import { NotFoundError, ValidationError } from "@/server/errors";
import { type TodoAttachment } from "@/db/schema/attachments";

describe("AttachmentService", () => {
  let service: AttachmentService;
  let mockAttachmentRepo: Mocked<IAttachmentRepository>;
  let mockTodoRepo: Mocked<ITodoRepository>;
  let mockPermissionService: Mocked<ListPermissionService>;
  let mockActivityService: Mocked<ActivityService>;
  let mockStorageAdapter: Mocked<ISupabaseStorageAdapter>;
  let mockDb: Database;

  const mockUserId = "user-1111-owner";
  const mockListId = "list-2222-uuid";
  const mockTodoId = "todo-3333-uuid";
  const mockAttachmentId = "attach-4444-uuid";

  const sampleActiveAttachment: TodoAttachment = {
    id: mockAttachmentId,
    todoId: mockTodoId,
    listId: mockListId,
    storagePath: `lists/${mockListId}/todos/${mockTodoId}/random-file.pdf`,
    originalFilename: "sample.pdf",
    sanitizedFilename: "sample.pdf",
    mimeType: "application/pdf",
    fileSize: 1024 * 100,
    status: "ACTIVE",
    expiresAt: null,
    deletedAt: null,
    uploadedBy: mockUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const samplePendingAttachment: TodoAttachment = {
    ...sampleActiveAttachment,
    status: "PENDING_UPLOAD",
    expiresAt: new Date(Date.now() + 600000),
  };

  beforeEach(() => {
    mockAttachmentRepo = {
      reserveUploadSlot: vi.fn(),
      findById: vi.fn(),
      findByStoragePath: vi.fn(),
      findActiveByTodoId: vi.fn(),
      findStoragePathsByTodoId: vi.fn(),
      countActiveAndPendingByTodoId: vi.fn(),
      getAttachmentCountsForTodos: vi.fn(),
      markActive: vi.fn(),
      markPendingDeletion: vi.fn(),
      hardDelete: vi.fn(),
      findExpiredReservations: vi.fn(),
      findPendingDeletions: vi.fn(),
    };

    mockTodoRepo = {
      findAllByListId: vi.fn(),
      findById: vi.fn(),
      findListIdByTodoId: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      updateDetails: vi.fn(),
      delete: vi.fn(),
      findByRecurrenceRuleAndOccurrence: vi.fn(),
      findActiveOccurrenceByRuleId: vi.fn(),
      detachRecurrence: vi.fn(),
      incrementVersion: vi.fn().mockResolvedValue({ id: "todo-1", listId: "list-1", version: 2 }),
      incrementVersions: vi.fn().mockResolvedValue([]),
    };

    mockPermissionService = {
      getUserRole: vi.fn(),
      requireOwner: vi.fn(),
      requireCanMutateTodos: vi.fn(),
      requireCanReadList: vi.fn(),
    } as unknown as Mocked<ListPermissionService>;

    mockActivityService = {
      logActivity: vi.fn(),
    } as unknown as Mocked<ActivityService>;

    mockStorageAdapter = {
      createSignedUploadUrl: vi.fn(),
      createSignedDownloadUrl: vi.fn(),
      fetchLeadingBytes: vi.fn(),
      removeObjects: vi.fn(),
      ensureBucketExists: vi.fn(),
    };

    const mockTx = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockDb = {
      transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockTx)),
    } as unknown as Database;

    service = new AttachmentService(
      mockAttachmentRepo,
      mockTodoRepo,
      mockPermissionService,
      mockActivityService,
      mockStorageAdapter,
      mockDb
    );
  });

  describe("createUploadAuthorization", () => {
    it("should reject mismatched extension and declared MIME type", async () => {
      await expect(
        service.createUploadAuthorization(
          {
            todoId: mockTodoId,
            filename: "photo.pdf",
            mimeType: "image/png",
            fileSize: 5000,
          },
          mockUserId
        )
      ).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError if parent todo is not found", async () => {
      mockTodoRepo.findListIdByTodoId.mockResolvedValue(null);

      await expect(
        service.createUploadAuthorization(
          {
            todoId: mockTodoId,
            filename: "report.pdf",
            mimeType: "application/pdf",
            fileSize: 5000,
          },
          mockUserId
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("should reject when user has read-only VIEWER permission", async () => {
      mockTodoRepo.findListIdByTodoId.mockResolvedValue(mockListId);
      mockPermissionService.requireCanMutateTodos.mockRejectedValue(
        new ValidationError("Viewers have read-only access and cannot modify tasks.")
      );

      await expect(
        service.createUploadAuthorization(
          {
            todoId: mockTodoId,
            filename: "report.pdf",
            mimeType: "application/pdf",
            fileSize: 5000,
          },
          mockUserId
        )
      ).rejects.toThrow(ValidationError);
    });

    it("should reject when task attachment limit is exceeded", async () => {
      mockTodoRepo.findListIdByTodoId.mockResolvedValue(mockListId);
      mockPermissionService.requireCanMutateTodos.mockResolvedValue("OWNER");
      mockAttachmentRepo.reserveUploadSlot.mockRejectedValue(
        new Error("TASK_ATTACHMENT_LIMIT_EXCEEDED")
      );

      await expect(
        service.createUploadAuthorization(
          {
            todoId: mockTodoId,
            filename: "report.pdf",
            mimeType: "application/pdf",
            fileSize: 5000,
          },
          mockUserId
        )
      ).rejects.toThrow(ValidationError);
    });

    it("should successfully reserve slot and return signed upload URL for authorized user", async () => {
      mockTodoRepo.findListIdByTodoId.mockResolvedValue(mockListId);
      mockPermissionService.requireCanMutateTodos.mockResolvedValue("OWNER");
      mockAttachmentRepo.reserveUploadSlot.mockResolvedValue(samplePendingAttachment);
      mockStorageAdapter.createSignedUploadUrl.mockResolvedValue({
        signedUrl: "https://storage.supabase.co/upload/signed?token=xyz",
        token: "xyz",
      });

      const result = await service.createUploadAuthorization(
        {
          todoId: mockTodoId,
          filename: "report.pdf",
          mimeType: "application/pdf",
          fileSize: 5000,
        },
        mockUserId
      );

      expect(result.attachmentId).toBe(samplePendingAttachment.id);
      expect(result.uploadUrl).toContain("signed?token=xyz");
      expect(result.storagePath).toContain(`lists/${mockListId}/todos/${mockTodoId}/`);
      expect(mockAttachmentRepo.reserveUploadSlot).toHaveBeenCalled();
    });
  });

  describe("confirmUploadedAttachment", () => {
    it("should return existing attachment immediately if already ACTIVE (idempotent)", async () => {
      mockAttachmentRepo.findById.mockResolvedValue(sampleActiveAttachment);
      mockPermissionService.requireCanMutateTodos.mockResolvedValue("OWNER");

      const result = await service.confirmUploadedAttachment(
        { attachmentId: mockAttachmentId },
        mockUserId
      );

      expect(result.id).toBe(mockAttachmentId);
      expect(result.status).toBe("ACTIVE");
      expect(mockStorageAdapter.fetchLeadingBytes).not.toHaveBeenCalled();
    });

    it("should reject when attachment record is not found", async () => {
      mockAttachmentRepo.findById.mockResolvedValue(null);

      await expect(
        service.confirmUploadedAttachment(
          { attachmentId: mockAttachmentId },
          mockUserId
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("should reject when uploaded file cannot be found in storage", async () => {
      mockAttachmentRepo.findById.mockResolvedValue(samplePendingAttachment);
      mockPermissionService.requireCanMutateTodos.mockResolvedValue("OWNER");
      mockStorageAdapter.fetchLeadingBytes.mockResolvedValue(null);

      await expect(
        service.confirmUploadedAttachment(
          { attachmentId: mockAttachmentId },
          mockUserId
        )
      ).rejects.toThrow(ValidationError);
    });

    it("should reject when magic byte check fails, removing storage object and purging reservation", async () => {
      mockAttachmentRepo.findById.mockResolvedValue(samplePendingAttachment);
      mockPermissionService.requireCanMutateTodos.mockResolvedValue("OWNER");
      // Corrupt magic bytes: not %PDF
      mockStorageAdapter.fetchLeadingBytes.mockResolvedValue(
        new Uint8Array([0x00, 0x01, 0x02, 0x03])
      );

      await expect(
        service.confirmUploadedAttachment(
          { attachmentId: mockAttachmentId },
          mockUserId
        )
      ).rejects.toThrow("File signature verification failed");

      // Verify compensating delete
      expect(mockStorageAdapter.removeObjects).toHaveBeenCalledWith([samplePendingAttachment.storagePath]);
      expect(mockAttachmentRepo.hardDelete).toHaveBeenCalledWith(mockAttachmentId);
    });

    it("should successfully activate attachment and log activity when magic bytes match", async () => {
      mockAttachmentRepo.findById.mockResolvedValue(samplePendingAttachment);
      mockPermissionService.requireCanMutateTodos.mockResolvedValue("OWNER");
      // Valid PDF magic bytes
      mockStorageAdapter.fetchLeadingBytes.mockResolvedValue(
        new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])
      );
      mockAttachmentRepo.markActive.mockResolvedValue(sampleActiveAttachment);

      const result = await service.confirmUploadedAttachment(
        { attachmentId: mockAttachmentId },
        mockUserId
      );

      expect(result.status).toBe("ACTIVE");
      expect(mockAttachmentRepo.markActive).toHaveBeenCalledWith(mockAttachmentId, undefined);
      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ATTACHMENT_UPLOADED",
          entityType: "ATTACHMENT",
          entityId: mockAttachmentId,
        }),
        undefined
      );
    });
  });

  describe("createDownloadAuthorization", () => {
    it("should throw NotFoundError if attachment does not exist or is not ACTIVE", async () => {
      mockAttachmentRepo.findById.mockResolvedValue(samplePendingAttachment); // Pending not active

      await expect(
        service.createDownloadAuthorization(
          { attachmentId: mockAttachmentId },
          mockUserId
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw NotFoundError if user has no access to the list", async () => {
      mockAttachmentRepo.findById.mockResolvedValue(sampleActiveAttachment);
      mockPermissionService.requireCanReadList.mockRejectedValue(
        new NotFoundError("Todo list not found.")
      );

      await expect(
        service.createDownloadAuthorization(
          { attachmentId: mockAttachmentId },
          mockUserId
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("should allow any authorized list member to generate signed download URL", async () => {
      mockAttachmentRepo.findById.mockResolvedValue(sampleActiveAttachment);
      mockPermissionService.requireCanReadList.mockResolvedValue("VIEWER");
      mockStorageAdapter.createSignedDownloadUrl.mockResolvedValue({
        signedUrl: "https://storage.supabase.co/download/signed?token=abc",
      });

      const result = await service.createDownloadAuthorization(
        { attachmentId: mockAttachmentId },
        mockUserId
      );

      expect(result.downloadUrl).toContain("signed?token=abc");
      expect(result.filename).toBe(sampleActiveAttachment.originalFilename);
      expect(mockStorageAdapter.createSignedDownloadUrl).toHaveBeenCalledWith(
        sampleActiveAttachment.storagePath,
        sampleActiveAttachment.sanitizedFilename,
        expect.any(Number)
      );
    });
  });

  describe("deleteAttachment", () => {
    it("should reject deletion when user has read-only VIEWER permission", async () => {
      mockAttachmentRepo.findById.mockResolvedValue(sampleActiveAttachment);
      mockPermissionService.requireCanMutateTodos.mockRejectedValue(
        new ValidationError("Viewers have read-only access and cannot modify tasks.")
      );

      await expect(
        service.deleteAttachment(
          { attachmentId: mockAttachmentId },
          mockUserId
        )
      ).rejects.toThrow(ValidationError);
    });

    it("should transition to PENDING_DELETION, log activity, and hard-delete on storage removal success", async () => {
      mockAttachmentRepo.findById.mockResolvedValue(sampleActiveAttachment);
      mockPermissionService.requireCanMutateTodos.mockResolvedValue("OWNER");
      mockAttachmentRepo.markPendingDeletion.mockResolvedValue({
        ...sampleActiveAttachment,
        status: "PENDING_DELETION",
      });
      mockStorageAdapter.removeObjects.mockResolvedValue(true);
      mockAttachmentRepo.hardDelete.mockResolvedValue(true);

      const result = await service.deleteAttachment(
        { attachmentId: mockAttachmentId },
        mockUserId
      );

      expect(result.success).toBe(true);
      expect(mockAttachmentRepo.markPendingDeletion).toHaveBeenCalledWith(mockAttachmentId, undefined);
      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ATTACHMENT_DELETED",
          entityType: "ATTACHMENT",
          entityId: mockAttachmentId,
        }),
        undefined
      );
      expect(mockStorageAdapter.removeObjects).toHaveBeenCalledWith([sampleActiveAttachment.storagePath]);
      expect(mockAttachmentRepo.hardDelete).toHaveBeenCalledWith(mockAttachmentId);
    });

    it("should preserve PENDING_DELETION state in DB if storage delete temporarily fails", async () => {
      mockAttachmentRepo.findById.mockResolvedValue(sampleActiveAttachment);
      mockPermissionService.requireCanMutateTodos.mockResolvedValue("OWNER");
      mockAttachmentRepo.markPendingDeletion.mockResolvedValue({
        ...sampleActiveAttachment,
        status: "PENDING_DELETION",
      });
      // Storage deletion fails
      mockStorageAdapter.removeObjects.mockResolvedValue(false);

      const result = await service.deleteAttachment(
        { attachmentId: mockAttachmentId },
        mockUserId
      );

      expect(result.success).toBe(true);
      // Hard delete is NOT called because storage removal failed; row remains PENDING_DELETION for sweeper
      expect(mockAttachmentRepo.hardDelete).not.toHaveBeenCalled();
    });
  });

  describe("cleanupBackgroundSweepers", () => {
    it("should clean up expired unconfirmed reservations", async () => {
      mockAttachmentRepo.findExpiredReservations.mockResolvedValue([samplePendingAttachment]);
      mockStorageAdapter.removeObjects.mockResolvedValue(true);
      mockAttachmentRepo.hardDelete.mockResolvedValue(true);

      const result = await service.cleanupExpiredReservations();
      expect(result.cleaned).toBe(1);
      expect(mockStorageAdapter.removeObjects).toHaveBeenCalledWith([samplePendingAttachment.storagePath]);
      expect(mockAttachmentRepo.hardDelete).toHaveBeenCalledWith(samplePendingAttachment.id);
    });

    it("should retry storage removal for items stuck in PENDING_DELETION", async () => {
      mockAttachmentRepo.findPendingDeletions.mockResolvedValue([
        { ...sampleActiveAttachment, status: "PENDING_DELETION" },
      ]);
      mockStorageAdapter.removeObjects.mockResolvedValue(true);
      mockAttachmentRepo.hardDelete.mockResolvedValue(true);

      const result = await service.cleanupPendingDeletions();
      expect(result.purged).toBe(1);
      expect(mockStorageAdapter.removeObjects).toHaveBeenCalledWith([sampleActiveAttachment.storagePath]);
      expect(mockAttachmentRepo.hardDelete).toHaveBeenCalledWith(sampleActiveAttachment.id);
    });
  });
});
