"use client";

import React from "react";
import type { RealtimeActivityNotification } from "@/hooks/use-realtime-board";
import { PlusCircle, RefreshCw, CheckCircle2, Trash2, UserPlus, UserMinus, X } from "lucide-react";

interface RealtimeActivityBannerProps {
  activity: RealtimeActivityNotification | null;
  onDismiss: () => void;
}

export function RealtimeActivityBanner({
  activity,
  onDismiss,
}: RealtimeActivityBannerProps) {
  if (!activity) {
    return null;
  }

  const iconMap = {
    TASK_CREATED: <PlusCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />,
    TASK_STATUS_CHANGED: <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />,
    TASK_UPDATED: <RefreshCw className="h-3.5 w-3.5 text-amber-500 shrink-0" />,
    TASK_DELETED: <Trash2 className="h-3.5 w-3.5 text-rose-500 shrink-0" />,
    COLLABORATOR_JOINED: <UserPlus className="h-3.5 w-3.5 text-indigo-500 shrink-0" />,
    COLLABORATOR_LEFT: <UserMinus className="h-3.5 w-3.5 text-neutral-400 shrink-0" />,
  };

  return (
    <aside
      role="status"
      aria-label="Realtime collaborator activity"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/95 px-3 py-1 text-xs text-neutral-700 shadow-sm backdrop-blur-xs transition-all animate-in fade-in slide-in-from-top-1 dark:border-neutral-800 dark:bg-neutral-900/95 dark:text-neutral-300"
    >
      {iconMap[activity.type] || <RefreshCw className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
      <span className="font-medium truncate max-w-[260px] sm:max-w-[400px]">
        {activity.message}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-1 rounded-full p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400"
        aria-label="Dismiss activity notification"
      >
        <X className="h-3 w-3" />
      </button>
    </aside>
  );
}
