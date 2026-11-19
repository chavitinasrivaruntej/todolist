"use client";

import React from "react";
import { Repeat } from "lucide-react";

interface RecurrenceBadgeProps {
  occurrenceNumber?: number | null;
  ruleStatus?: string | null;
  className?: string;
}

export function RecurrenceBadge({
  occurrenceNumber,
  className = "",
}: RecurrenceBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60 ${className}`}
      title={
        occurrenceNumber
          ? `Recurring task (Occurrence #${occurrenceNumber})`
          : "Recurring task"
      }
    >
      <Repeat className="h-2.5 w-2.5" />
      <span>{occurrenceNumber ? `#${occurrenceNumber}` : "Repeating"}</span>
    </span>
  );
}
