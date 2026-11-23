import crypto from "crypto";
import { db as defaultDb, type Database } from "@/db";
import { withTransaction } from "@/server/utils/transaction";
import {
  type IAttachmentRepository,
  attachmentRepository as defaultAttachmentRepo,
} from "@/server/repositories/attachment.repository";
import {
  type ITodoRepository,
  todoRepository as defaultTodoRepo,
} from "@/server/repositories/todo.repository";
import {
  ListPermissionService,
  listPermissionService as defaultPermissionService,
} from "@/server/services/list-permission.service";
import {
  ActivityService,
  activityService as defaultActivityService,
} from "@/server/services/activity.service";
import {
  type ISupabaseStorageAdapter,
  supabaseStorageAdapter as defaultStorageAdapter,
} from "@/lib/storage/supabase-storage";
import {
  type IRealtimePublisherService,
  realtimePublisherService as defaultRealtimePublisher,
} from "@/server/services/realtime-publisher.service";
import {
  type CreateUploadUrlInput,
  type ConfirmUploadInput,
  type CreateDownloadUrlInput,
  type DeleteAttachmentInput,
  type AllowedMimeType,
  MAX_ATTACHMENTS_PER_TODO,
  UPLOAD_URL_EXPIRY_SECONDS,
  DOWNLOAD_URL_EXPIRY_SECONDS,
  RESERVATION_EXPIRY_MINUTES,
  sanitizeFilename,
  validateExtensionForMime,
  verifyMagicBytes,
} from "@/lib/validations/attachment";
import { type TodoAttachment } from "@/db/schema/attachments";
import { NotFoundError, ValidationError } from "@/server/errors";

export class AttachmentService {
  private readonly repository: IAttachmentRepository;
  private readonly todoRepository: ITodoRepository;
  private readonly permissionService: ListPermissionService;
  private readonly activityService: ActivityService;
  private readonly storageAdapter: ISupabaseStorageAdapter;
  private readonly realtimePublisher: IRealtimePublisherService;
  private readonly db: Database;

  constructor(
    repository: IAttachmentRepository = defaultAttachmentRepo,
    todoRepository: ITodoRepository = defaultTodoRepo,
    permissionService: ListPermissionService = defaultPermissionService,
    activityService: ActivityService = defaultActivityService,
    storageAdapter: ISupabaseStorageAdapter = defaultStorageAdapter,
    database: Database = defaultDb,
    realtimePublisher: IRealtimePublisherService = defaultRealtimePublisher
  ) {
    this.repository = repository;
    this.todoRepository = todoRepository;
    this.permissionService = permissionService;
    this.activityService = activityService;
    this.storageAdapter = storageAdapter;
    this.realtimePublisher = realtimePublisher;
    this.db = database;
  }

  /**
   * Authorizes upload intent, reserves a slot under row-level locking, and generates a restricted signed upload URL.
   */
  async createUploadAuthorization(
    input: CreateUploadUrlInput,
    userId: string
  ): Promise<{
    attachmentId: string;
    uploadUrl: string;
    token: string;
    storagePath: string;
    expiresIn: number;
  }> {
    // 1. Verify extension matches declared MIME
    if (!validateExtensionForMime(input.filename, input.mimeType as AllowedMimeType)) {
      throw new ValidationError(
        `File extension does not match the declared MIME type (${input.mimeType}).`
      );
    }

    // 2. Resolve parent list ID from todo
    const listId = await this.todoRepository.findListIdByTodoId(input.todoId);
    if (!listId) {
      throw new NotFoundError(`Todo with ID ${input.todoId} was not found.`);
    }

    // 3. Verify user permissions (OWNER or EDITOR)
    await this.permissionService.requireCanMutateTodos(userId, listId);

    // 4. Sanitize filename and construct deterministic storage path
    const sanitized = sanitizeFilename(input.filename);
    const fileUuid = crypto.randomUUID();
    const storagePath = `lists/${listId}/todos/${input.todoId}/${fileUuid}-${sanitized}`;
    const expiresAt = new Date(Date.now() + RESERVATION_EXPIRY_MINUTES * 60 * 1000);

    // 5. Atomically reserve slot under transaction row lock
    let reservation: TodoAttachment;
    try {
      reservation = await withTransaction(this.db, async (tx) => {
        return this.repository.reserveUploadSlot(
          {
            todoId: input.todoId,
            listId,
            storagePath,
            originalFilename: input.filename,
            sanitizedFilename: sanitized,
            mimeType: input.mimeType,
            fileSize: input.fileSize,
            uploadedBy: userId,
            expiresAt,
          },
          MAX_ATTACHMENTS_PER_TODO,
          tx
        );
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "TASK_ATTACHMENT_LIMIT_EXCEEDED") {
        throw new ValidationError(
          `Task has reached the maximum limit of ${MAX_ATTACHMENTS_PER_TODO} attachments.`
        );
      }
      throw err;
    }

    // 6. Generate signed upload URL from Supabase Storage
    const { signedUrl, token } = await this.storageAdapter.createSignedUploadUrl(
      storagePath,
      UPLOAD_URL_EXPIRY_SECONDS
    );

    return {
      attachmentId: reservation.id,
      uploadUrl: signedUrl,
      token,
      storagePath,
      expiresIn: UPLOAD_URL_EXPIRY_SECONDS,
    };
  }

  /**
   * Idempotently verifies object presence and magic-byte signature in Supabase Storage,
   * transitions reservation from PENDING_UPLOAD to ACTIVE, and records activity audit log.
   */
  async confirmUploadedAttachment(
    input: ConfirmUploadInput,
    userId: string
  ): Promise<TodoAttachment> {
    const attachment = await this.repository.findById(input.attachmentId);
    if (!attachment) {
      throw new NotFoundError(`Attachment with ID ${input.attachmentId} was not found.`);
    }

    // Authorization check
    await this.permissionService.requireCanMutateTodos(userId, attachment.listId);

    // Idempotent: If already active, return immediately
    if (attachment.status === "ACTIVE") {
      return attachment;
    }

    if (attachment.status === "PENDING_DELETION") {
      throw new ValidationError("Attachment is marked for deletion and cannot be confirmed.");
    }

    // Inspect leading bytes to verify binary signature
    const leadingBytes = await this.storageAdapter.fetchLeadingBytes(attachment.storagePath);
    if (!leadingBytes) {
      throw new ValidationError(
        "Uploaded file could not be verified in storage. Please retry the upload."
      );
    }

    const isValidSignature = verifyMagicBytes(
      leadingBytes,
      attachment.mimeType as AllowedMimeType
    );

    if (!isValidSignature) {
      // Compensating action: Delete corrupted or spoofed binary from storage and purge reservation
      await this.storageAdapter.removeObjects([attachment.storagePath]);
      await this.repository.hardDelete(attachment.id);
      throw new ValidationError(
        "File signature verification failed: content does not match declared MIME type."
      );
    }

    // Atomically transition status to ACTIVE and log activity
    const result = await withTransaction(this.db, async (tx) => {
      const activeAttachment = await this.repository.markActive(attachment.id, tx);
      if (!activeAttachment) {
        throw new NotFoundError(`Failed to activate attachment ${attachment.id}.`);
      }

      await this.activityService.logActivity(
        {
          listId: activeAttachment.listId,
          actorId: userId,
          action: "ATTACHMENT_UPLOADED",
          entityType: "ATTACHMENT",
          entityId: activeAttachment.id,
          metadata: {
            todoId: activeAttachment.todoId,
            filename: activeAttachment.originalFilename,
            fileSize: activeAttachment.fileSize,
            mimeType: activeAttachment.mimeType,
          },
        },
        tx
      );

      return activeAttachment;
    });

    // Broadcast attachment count update post-commit
    try {
      const countsMap = await this.repository.getAttachmentCountsForTodos([result.todoId]);
      const count = countsMap.get(result.todoId) || 0;
      await this.realtimePublisher.publishTaskAttachmentUpdated(
        result.listId,
        userId,
        null,
        result.todoId,
        count,
        1
      );
    } catch {
      // Handled silently
    }

    return result;
  }

  /**
   * Generates a short-lived signed download URL enforcing Content-Disposition attachment.
   */
  async createDownloadAuthorization(
    input: CreateDownloadUrlInput,
    userId: string
  ): Promise<{
    downloadUrl: string;
    filename: string;
    mimeType: string;
    expiresIn: number;
  }> {
    const attachment = await this.repository.findById(input.attachmentId);
    if (!attachment || attachment.status !== "ACTIVE") {
      throw new NotFoundError(`Attachment with ID ${input.attachmentId} was not found.`);
    }

    // Authorization check: Any list member (OWNER, EDITOR, VIEWER)
    await this.permissionService.requireCanReadList(userId, attachment.listId);

    const { signedUrl } = await this.storageAdapter.createSignedDownloadUrl(
      attachment.storagePath,
      attachment.sanitizedFilename,
      DOWNLOAD_URL_EXPIRY_SECONDS
    );

    return {
      downloadUrl: signedUrl,
      filename: attachment.originalFilename,
      mimeType: attachment.mimeType,
      expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS,
    };
  }

  /**
   * Retrieves all active attachments for a task.
   */
  async getAttachmentsByTodo(todoId: string, userId: string): Promise<TodoAttachment[]> {
    const listId = await this.todoRepository.findListIdByTodoId(todoId);
    if (!listId) {
      throw new NotFoundError(`Todo with ID ${todoId} was not found.`);
    }

    await this.permissionService.requireCanReadList(userId, listId);
    return this.repository.findActiveByTodoId(todoId);
  }

  /**
   * Two-phase deletion: Marks record PENDING_DELETION in DB (instant UI update),
   * removes storage object, and hard-deletes row upon success.
   */
  async deleteAttachment(
    input: DeleteAttachmentInput,
    userId: string
  ): Promise<{ success: boolean; id: string }> {
    const attachment = await this.repository.findById(input.attachmentId);
    if (!attachment || attachment.status !== "ACTIVE") {
      throw new NotFoundError(`Attachment with ID ${input.attachmentId} was not found.`);
    }

    await this.permissionService.requireCanMutateTodos(userId, attachment.listId);

    // Phase 1: Mark PENDING_DELETION and log activity in atomic transaction
    await withTransaction(this.db, async (tx) => {
      const marked = await this.repository.markPendingDeletion(attachment.id, tx);
      if (!marked) {
        throw new NotFoundError(`Attachment with ID ${attachment.id} was not found.`);
      }

      await this.activityService.logActivity(
        {
          listId: attachment.listId,
          actorId: userId,
          action: "ATTACHMENT_DELETED",
          entityType: "ATTACHMENT",
          entityId: attachment.id,
          metadata: {
            todoId: attachment.todoId,
            filename: attachment.originalFilename,
            fileSize: attachment.fileSize,
          },
        },
        tx
      );
    });

    // Phase 2: Remove object from storage
    const storageSuccess = await this.storageAdapter.removeObjects([attachment.storagePath]);
    if (storageSuccess) {
      // Hard-delete row now that storage object is gone
      await this.repository.hardDelete(attachment.id);
    }
    // If storage deletion temporarily fails, row remains PENDING_DELETION for background retry

    // Broadcast attachment count update post-deletion
    try {
      const countsMap = await this.repository.getAttachmentCountsForTodos([attachment.todoId]);
      const count = countsMap.get(attachment.todoId) || 0;
      await this.realtimePublisher.publishTaskAttachmentUpdated(
        attachment.listId,
        userId,
        null,
        attachment.todoId,
        count,
        1
      );
    } catch {
      // Handled silently
    }

    return {
      success: true,
      id: attachment.id,
    };
  }

  /**
   * Background sweeper: Cleans up unconfirmed reservations that have expired.
   */
  async cleanupExpiredReservations(): Promise<{ cleaned: number }> {
    const now = new Date();
    const expired = await this.repository.findExpiredReservations(now);
    let cleaned = 0;

    for (const item of expired) {
      await this.storageAdapter.removeObjects([item.storagePath]);
      await this.repository.hardDelete(item.id);
      cleaned++;
    }

    return { cleaned };
  }

  /**
   * Background sweeper: Retries storage deletion for items stuck in PENDING_DELETION.
   */
  async cleanupPendingDeletions(): Promise<{ purged: number }> {
    // Cutoff: 1 minute ago to allow in-flight deletes to finish
    const cutoff = new Date(Date.now() - 60 * 1000);
    const pending = await this.repository.findPendingDeletions(cutoff);
    let purged = 0;

    for (const item of pending) {
      const removed = await this.storageAdapter.removeObjects([item.storagePath]);
      if (removed) {
        await this.repository.hardDelete(item.id);
        purged++;
      }
    }

    return { purged };
  }
}

export const attachmentService = new AttachmentService();
