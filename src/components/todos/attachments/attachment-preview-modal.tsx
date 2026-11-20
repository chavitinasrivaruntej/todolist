"use client";

import React from "react";
import { X, Download, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AttachmentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  filename: string;
  mimeType: string;
  downloadUrl: string;
}

export function AttachmentPreviewModal({
  isOpen,
  onClose,
  filename,
  mimeType,
  downloadUrl,
}: AttachmentPreviewModalProps) {
  if (!isOpen) return null;

  const isImage = mimeType.startsWith("image/");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 truncate pr-4">
            {isImage ? (
              <ImageIcon className="h-5 w-5 text-blue-500 shrink-0" />
            ) : (
              <FileText className="h-5 w-5 text-indigo-500 shrink-0" />
            )}
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm">
              {filename}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={downloadUrl}
              download={filename}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-50 dark:bg-slate-950/50 min-h-[300px]">
          {isImage ? (
            <img
              src={downloadUrl}
              alt={filename}
              className="max-h-[70vh] max-w-full rounded-lg object-contain shadow-sm"
            />
          ) : (
            <div className="text-center p-8 space-y-4">
              <FileText className="h-16 w-16 text-slate-400 mx-auto" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Preview is not available for this file format ({mimeType}).
              </p>
              <a
                href={downloadUrl}
                download={filename}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
              >
                <Download className="h-4 w-4" />
                Download to View
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
