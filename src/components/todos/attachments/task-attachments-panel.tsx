"use client";

import React, { useState, useRef } from "react";
import {
  Paperclip,
  Upload,
  Loader2,
  AlertCircle,
  Plus,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { AttachmentItem } from "./attachment-item";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_TODO,
  ALLOWED_MIME_TYPE_SET,
} from "@/lib/validations/attachment";

interface TaskAttachmentsPanelProps {
  todoId: string;
  listId: string;
  isReadOnly?: boolean;
}

export function TaskAttachmentsPanel({
  todoId,
  listId,
  isReadOnly = false,
}: TaskAttachmentsPanelProps) {
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // Query active attachments
  const {
    data: attachments,
    isLoading,
    error: queryError,
  } = trpc.attachment.getByTodo.useQuery({ todoId });

  // Mutations
  const createUploadUrlMutation = trpc.attachment.createUploadUrl.useMutation();
  const confirmUploadMutation = trpc.attachment.confirmUpload.useMutation();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setUploadError(null);

    // Client-side validations
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setUploadError("File exceeds the maximum size limit of 10MB.");
      return;
    }

    if (!ALLOWED_MIME_TYPE_SET.has(file.type)) {
      setUploadError(
        "File format not supported. Only PNG, JPEG, WebP, PDF, Word, Excel, CSV, and text files are allowed."
      );
      return;
    }

    const currentCount = attachments?.length || 0;
    if (currentCount >= MAX_ATTACHMENTS_PER_TODO) {
      setUploadError(`Maximum of ${MAX_ATTACHMENTS_PER_TODO} attachments reached for this task.`);
      return;
    }

    try {
      setUploadProgress(5);

      // 1. Create upload authorization & reserve slot
      const authorization = await createUploadUrlMutation.mutateAsync({
        todoId,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });

      setUploadProgress(20);

      // 2. Direct binary upload to Supabase Storage via XMLHttpRequest for progress events
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", authorization.uploadUrl, true);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = 20 + Math.round((event.loaded / event.total) * 60);
            setUploadProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Storage rejected upload with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network failure during file upload"));
        xhr.send(file);
      });

      setUploadProgress(85);

      // 3. Confirm upload and activate record
      await confirmUploadMutation.mutateAsync({
        attachmentId: authorization.attachmentId,
      });

      setUploadProgress(100);

      // Invalidate queries to refresh UI
      await Promise.all([
        utils.attachment.getByTodo.invalidate({ todoId }),
        utils.todo.list.invalidate({ listId }),
      ]);

      setTimeout(() => setUploadProgress(null), 800);
    } catch (err: unknown) {
      setUploadProgress(null);
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload file. Please try again."
      );
    }
  };

  const attachmentCount = attachments?.length || 0;
  const isAtLimit = attachmentCount >= MAX_ATTACHMENTS_PER_TODO;

  return (
    <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <Paperclip className="h-3.5 w-3.5 text-slate-500" />
          <span>Attachments</span>
          <span className="text-[11px] font-normal text-slate-400">
            ({attachmentCount}/{MAX_ATTACHMENTS_PER_TODO})
          </span>
        </div>

        {!isReadOnly && !isAtLimit && (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadProgress !== null}
              className="h-7 text-xs px-2.5 gap-1 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              <Plus className="h-3.5 w-3.5" />
              Add File
            </Button>
          </div>
        )}
      </div>

      {/* Upload Progress Bar */}
      {uploadProgress !== null && (
        <div className="space-y-1 p-2 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
          <div className="flex items-center justify-between text-[11px] text-indigo-700 dark:text-indigo-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Loader2 className="h-3 w-3 animate-spin" />
              Uploading file...
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-indigo-200/50 dark:bg-indigo-900/50 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Alert */}
      {uploadError && (
        <div className="flex items-center gap-1.5 p-2 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-[11px] text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Attachment List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4 text-xs text-slate-400 gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading attachments...
        </div>
      ) : queryError ? (
        <p className="text-[11px] text-rose-500 py-1">Failed to load attachments.</p>
      ) : attachments && attachments.length > 0 ? (
        <div className="space-y-1.5">
          {attachments.map((attachment) => (
            <AttachmentItem
              key={attachment.id}
              attachment={attachment}
              listId={listId}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 italic py-1">No files attached to this task.</p>
      )}
    </div>
  );
}
