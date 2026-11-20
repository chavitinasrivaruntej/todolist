import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { attachmentService } from "@/server/services/attachment.service";
import {
  createUploadUrlSchema,
  confirmUploadSchema,
  getAttachmentsByTodoSchema,
  createDownloadUrlSchema,
  deleteAttachmentSchema,
} from "@/lib/validations/attachment";

export const attachmentRouter = createTRPCRouter({
  /**
   * Reserves an upload slot under row lock and generates a single-use signed upload URL.
   * Allowed for OWNER and EDITOR roles.
   */
  createUploadUrl: protectedProcedure
    .input(createUploadUrlSchema)
    .mutation(async ({ input, ctx }) => {
      return attachmentService.createUploadAuthorization(input, ctx.user.id);
    }),

  /**
   * Confirms a completed upload, verifies magic-byte binary signature, and activates the attachment.
   * Idempotent. Allowed for OWNER and EDITOR roles.
   */
  confirmUpload: protectedProcedure
    .input(confirmUploadSchema)
    .mutation(async ({ input, ctx }) => {
      return attachmentService.confirmUploadedAttachment(input, ctx.user.id);
    }),

  /**
   * Retrieves all active attachments belonging to a task.
   * Allowed for OWNER, EDITOR, and VIEWER roles.
   */
  getByTodo: protectedProcedure
    .input(getAttachmentsByTodoSchema)
    .query(async ({ input, ctx }) => {
      return attachmentService.getAttachmentsByTodo(input.todoId, ctx.user.id);
    }),

  /**
   * Generates a short-lived signed download URL enforcing Content-Disposition.
   * Allowed for OWNER, EDITOR, and VIEWER roles.
   */
  createDownloadUrl: protectedProcedure
    .input(createDownloadUrlSchema)
    .mutation(async ({ input, ctx }) => {
      return attachmentService.createDownloadAuthorization(input, ctx.user.id);
    }),

  /**
   * Deletes an attachment via two-phase deletion.
   * Allowed for OWNER and EDITOR roles.
   */
  delete: protectedProcedure
    .input(deleteAttachmentSchema)
    .mutation(async ({ input, ctx }) => {
      return attachmentService.deleteAttachment(input, ctx.user.id);
    }),
});
