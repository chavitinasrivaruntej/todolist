"use client";

import React from "react";
import { type Tag } from "@/db/schema/tags";
import { X } from "lucide-react";

export const TAG_COLOR_STYLES: Record<string, { bg: string; dot: string }> = {
  slate: {
    bg: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    dot: "bg-slate-500",
  },
  red: {
    bg: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900",
    dot: "bg-red-500",
  },
  orange: {
    bg: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900",
    dot: "bg-orange-500",
  },
  amber: {
    bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
    dot: "bg-amber-500",
  },
  emerald: {
    bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
    dot: "bg-emerald-500",
  },
  teal: {
    bg: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-900",
    dot: "bg-teal-500",
  },
  blue: {
    bg: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900",
    dot: "bg-blue-500",
  },
  indigo: {
    bg: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-900",
    dot: "bg-indigo-500",
  },
  purple: {
    bg: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900",
    dot: "bg-purple-500",
  },
  pink: {
    bg: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-900",
    dot: "bg-pink-500",
  },
};

export function getTagStyle(color: string) {
  return TAG_COLOR_STYLES[color] || TAG_COLOR_STYLES.slate;
}

interface TagBadgeProps {
  tag: Pick<Tag, "name" | "color"> & { id?: string };
  size?: "sm" | "md";
  onRemove?: () => void;
  className?: string;
  onClick?: () => void;
}

export function TagBadge({
  tag,
  size = "sm",
  onRemove,
  className = "",
  onClick,
}: TagBadgeProps) {
  const style = getTagStyle(tag.color);

  const sizeClasses =
    size === "sm"
      ? "text-[10px] px-1.5 py-0.5 gap-1"
      : "text-xs px-2 py-0.5 gap-1.5";

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center font-medium rounded border ${style.bg} ${sizeClasses} ${
        onClick ? "cursor-pointer hover:opacity-85" : ""
      } ${className}`}
      title={`Tag: ${tag.name}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${style.dot}`} />
      <span className="truncate max-w-[120px]">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-75 focus:outline-none shrink-0"
          aria-label={`Remove tag ${tag.name}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
