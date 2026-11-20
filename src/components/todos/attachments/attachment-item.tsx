"use client";

import React, { useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
  File,
  Download,
  Trash2,
  Loader2,
  Eye,
} from "lucide-react";
import { type TodoAttachment } from "@/db/schema/attachments";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { AttachmentPreviewModal } from "./attachment-preview-modal";

export interface AttachmentItemData
  extends Omit<TodoAttachment, "createdAt" | "updatedAt" | "expiresAt" | "deletedAt"> {
  createdAt: string | Date;
  updatedAt?: string | Date;
  expiresAt?: string | Date | null;
  deletedAt?: string | Date | null;
}

interface AttachmentItemProps {
  attachment: AttachmentItemData;
  listId: string;
  isReadOnly?: boolean;
  onDeleted?: () => void;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />;
  }
  if (mimeType.includes("pdf") || mimeType.includes("word")) {
    return <FileText className="h-4 w-4 text-rose-500 shrink-0" />;
  }
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv")) {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-500 shrink-0" />;
  }
  if (mimeType.includes("markdown") || mimeType.includes("plain")) {
    return <FileCode className="h-4 w-4 text-amber-500 shrink-0" />;
  }
  return <File className="h-4 w-4 text-slate-500 shrink-0" />;
}

export function AttachmentItem({
  attachment,
  listId,
  isReadOnly = false,
  onDeleted,
}: AttachmentItemProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const downloadMutation = trpc.attachment.createDownloadUrl.useMutation({
    onSuccess: (data) => {
      setIsDownloading(false);
      // Trigger browser download via hidden anchor
      const a = document.createElement("a");
      a.href = data.downloadUrl;
      a.download = data.filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    onError: (err) => {
      setIsDownloading(false);
      setErrorMessage(err.message || "Failed to generate download link.");
    },
  });

  const previewMutation = trpc.attachment.createDownloadUrl.useMutation({
    onSuccess: (data) => {
      setPreviewUrl(data.downloadUrl);
      setIsPreviewOpen(true);
    },
    onError: (err) => {
      setErrorMessage(err.message || "Failed to load preview.");
    },
  });

  const deleteMutation = trpc.attachment.delete.useMutation({
    onSuccess: async () => {
      setIsDeleting(false);
      await Promise.all([
        utils.attachment.getByTodo.invalidate({ todoId: attachment.todoId }),
        utils.todo.list.invalidate({ listId }),
      ]);
      onDeleted?.();
    },
    onError: (err) => {
      setIsDeleting(false);
      setErrorMessage(err.message || "Failed to delete attachment.");
    },
  });

  const handleDownload = () => {
    setErrorMessage(null);
    setIsDownloading(true);
    downloadMutation.mutate({ attachmentId: attachment.id });
  };

  const handlePreview = () => {
    setErrorMessage(null);
    if (previewUrl) {
      setIsPreviewOpen(true);
    } else {
      previewMutation.mutate({ attachmentId: attachment.id });
    }
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${attachment.originalFilename}"?`)) {
      setErrorMessage(null);
      setIsDeleting(true);
      deleteMutation.mutate({ attachmentId: attachment.id });
    }
  };

  const isImage = attachment.mimeType.startsWith("image/");

  return (
    <>
      <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors group">
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          {getFileIcon(attachment.mimeType)}
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate" title={attachment.originalFilename}>
              {attachment.originalFilename}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {formatFileSize(attachment.fileSize)} •{" "}
              {new Date(attachment.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isImage && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handlePreview}
              disabled={previewMutation.isPending}
              className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600"
              title="Preview image"
            >
              {previewMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
            className="h-7 w-7 p-0 text-slate-500 hover:text-indigo-600"
            title="Download file"
          >
            {isDownloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </Button>

          {!isReadOnly && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
              title="Delete attachment"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {errorMessage && (
        <p className="text-[11px] text-rose-600 dark:text-rose-400 px-1">{errorMessage}</p>
      )}

      {isImage && previewUrl && (
        <AttachmentPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          filename={attachment.originalFilename}
          mimeType={attachment.mimeType}
          downloadUrl={previewUrl}
        />
      )}
    </>
  );
}
