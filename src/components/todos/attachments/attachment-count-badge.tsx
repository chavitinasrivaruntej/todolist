"use client";

import React from "react";
import { Paperclip } from "lucide-react";

interface AttachmentCountBadgeProps {
  count?: number;
  className?: string;
}

export function AttachmentCountBadge({
  count = 0,
  className = "",
}: AttachmentCountBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors ${className}`}
      title={`${count} attachment${count === 1 ? "" : "s"}`}
    >
      <Paperclip className="h-3 w-3 text-slate-500" />
      <span>{count}</span>
    </span>
  );
}
