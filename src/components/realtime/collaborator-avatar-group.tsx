"use client";

import React from "react";
import type { UniqueCollaborator } from "@/hooks/use-realtime-board";
import { Crown, Shield, Eye, Users } from "lucide-react";

interface CollaboratorAvatarGroupProps {
  collaborators: UniqueCollaborator[];
  currentUserId?: string;
  showEmptyState?: boolean;
}

const AVATAR_COLORS = [
  "bg-blue-600 text-white",
  "bg-emerald-600 text-white",
  "bg-purple-600 text-white",
  "bg-amber-600 text-white",
  "bg-rose-600 text-white",
  "bg-indigo-600 text-white",
  "bg-teal-600 text-white",
];

function getAvatarColor(identifier: string): string {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index] || "bg-neutral-600 text-white";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name[0] || "U").toUpperCase();
}

export function CollaboratorAvatarGroup({
  collaborators,
  currentUserId,
  showEmptyState = false,
}: CollaboratorAvatarGroupProps) {
  if (collaborators.length === 0) {
    if (showEmptyState) {
      return (
        <div
          className="flex items-center gap-1 text-[11px] text-neutral-400 dark:text-neutral-500"
          aria-label="No other collaborators online"
        >
          <Users className="h-3.5 w-3.5" />
          <span>No other collaborators</span>
        </div>
      );
    }
    return null;
  }

  const maxVisible = 4;
  const visibleCollaborators = collaborators.slice(0, maxVisible);
  const remainingCount = collaborators.length - maxVisible;

  return (
    <div
      className="flex items-center -space-x-1.5 overflow-hidden"
      aria-label="Active collaborators on this list"
      role="group"
    >
      {visibleCollaborators.map((c) => {
        const isCurrent = c.userId === currentUserId;
        const colorClass = getAvatarColor(c.userId);
        const initials = getInitials(c.displayName);

        return (
          <div
            key={c.userId}
            className="group relative focus:outline-none"
            tabIndex={0}
            role="img"
            aria-label={`${c.displayName} (${c.role})${isCurrent ? " - You" : ""}${
              c.sessionCount > 1 ? ` • ${c.sessionCount} active tabs` : ""
            }`}
            title={`${c.displayName} (${c.role})${isCurrent ? " - You" : ""}${
              c.sessionCount > 1 ? ` • ${c.sessionCount} tabs` : ""
            }`}
          >
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ring-2 ring-white dark:ring-neutral-900 transition-all group-hover:scale-110 group-hover:z-10 group-focus-visible:scale-110 group-focus-visible:ring-offset-2 group-focus-visible:ring-neutral-400 dark:group-focus-visible:ring-neutral-500 ${colorClass}`}
            >
              {initials}
            </div>

            {/* Active multi-tab count badge */}
            {c.sessionCount > 1 && (
              <span className="absolute -bottom-1 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-neutral-900 px-0.5 text-[9px] font-bold text-white ring-1 ring-white dark:bg-neutral-100 dark:text-neutral-900 dark:ring-neutral-900">
                {c.sessionCount}
              </span>
            )}

            {/* Hover & Focus Tooltip */}
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-neutral-100 dark:text-neutral-900 z-50">
              <div className="flex items-center gap-1 font-medium">
                {c.role === "OWNER" && <Crown className="h-3 w-3 text-amber-400" />}
                {c.role === "EDITOR" && <Shield className="h-3 w-3 text-blue-400" />}
                {c.role === "VIEWER" && <Eye className="h-3 w-3 text-neutral-400" />}
                <span>
                  {c.displayName}
                  {isCurrent && " (You)"}
                </span>
              </div>
              <div className="text-[10px] text-neutral-400 dark:text-neutral-500">
                Viewing {c.activeView}
                {c.sessionCount > 1 ? ` • ${c.sessionCount} tabs` : ""}
              </div>
            </div>
          </div>
        );
      })}

      {remainingCount > 0 && (
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-700 ring-2 ring-white dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-900 focus:outline-none group-focus-visible:ring-offset-2"
          tabIndex={0}
          role="img"
          aria-label={`${remainingCount} more collaborators`}
          title={`${remainingCount} more collaborator${remainingCount === 1 ? "" : "s"}`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
