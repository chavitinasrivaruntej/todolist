"use client";

import React from "react";
import {
  PlusCircle,
  Edit3,
  ArrowRightCircle,
  Trash2,
  Sparkles,
  Edit2,
  Mail,
  UserCheck,
  UserX,
  UserPlus,
  UserMinus,
  LogOut,
  ShieldAlert,
  Clock,
} from "lucide-react";
import type { ActivityAction } from "@/db/schema/activities";

export interface ActivityItemData {
  id: string;
  listId: string;
  actorId: string | null;
  actorEmail: string | null;
  action: ActivityAction;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string | Date;
}

interface ActivityItemProps {
  activity: ActivityItemData;
}

function formatTimestamp(dateInput: string | Date): string {
  const date = new Date(dateInput);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getActivityConfig(activity: ActivityItemData) {
  const actor = activity.actorEmail ? activity.actorEmail.split("@")[0] : "Collaborator";
  const m = (activity.metadata || {}) as Record<string, string | number | boolean | null | undefined>;

  switch (activity.action) {
    case "TODO_CREATED":
      return {
        icon: <PlusCircle className="h-3.5 w-3.5 text-blue-500" />,
        text: (
          <span>
            <strong className="text-neutral-900 dark:text-neutral-100">{actor}</strong> created task{" "}
            <span className="font-medium text-neutral-800 dark:text-neutral-200">&quot;{m.title || "Untitled"}&quot;</span>
          </span>
        ),
      };
    case "TODO_UPDATED": {
      const parts: React.ReactNode[] = [];
      if (m.previousTitle && m.newTitle && m.previousTitle !== m.newTitle) {
        parts.push(
          <span key="title">
            renamed task from <span className="line-through text-neutral-400">&quot;{m.previousTitle}&quot;</span> to{" "}
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">&quot;{m.newTitle}&quot;</span>
          </span>
        );
      }
      if (m.previousPriority && m.newPriority && m.previousPriority !== m.newPriority) {
        parts.push(
          <span key="priority">
            changed priority from{" "}
            <span className="font-medium underline decoration-dotted">{m.previousPriority}</span> to{" "}
            <span className="font-semibold">{m.newPriority}</span>
          </span>
        );
      }
      if (
        m.previousDueDate !== undefined &&
        m.newDueDate !== undefined &&
        m.previousDueDate !== m.newDueDate
      ) {
        if (!m.newDueDate) {
          parts.push(
            <span key="due">
              removed due date (was {m.previousDueDate})
            </span>
          );
        } else if (!m.previousDueDate) {
          parts.push(
            <span key="due">
              set due date to <span className="font-semibold">{m.newDueDate}</span>
            </span>
          );
        } else {
          parts.push(
            <span key="due">
              changed due date from {m.previousDueDate} to{" "}
              <span className="font-semibold">{m.newDueDate}</span>
            </span>
          );
        }
      }

      if (parts.length === 0) {
        return {
          icon: <Edit3 className="h-3.5 w-3.5 text-sky-500" />,
          text: (
            <span>
              <strong className="text-neutral-900 dark:text-neutral-100">{actor}</strong> updated task{" "}
              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                &quot;{m.title || m.newTitle || "Task"}&quot;
              </span>
            </span>
          ),
        };
      }

      return {
        icon: <Edit3 className="h-3.5 w-3.5 text-sky-500" />,
        text: (
          <span>
            <strong className="text-neutral-900 dark:text-neutral-100">{actor}</strong>{" "}
            {parts.map((p, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && ", "}
                {p}
              </React.Fragment>
            ))}
            {m.title && !parts.some((p) => (p as React.ReactElement).key === "title") && (
              <span className="text-neutral-500"> on &quot;{m.title}&quot;</span>
            )}
          </span>
        ),
      };
    }
    case "TODO_STATUS_CHANGED":
      return {
        icon: <ArrowRightCircle className="h-3.5 w-3.5 text-emerald-500" />,
        text: (
          <span>
            <strong className="text-neutral-900 dark:text-neutral-100">{actor}</strong> moved{" "}
            <span className="font-medium text-neutral-800 dark:text-neutral-200">&quot;{m.title || "Task"}&quot;</span>{" "}
            from <span className="underline decoration-dotted">{m.previousStatus}</span> to{" "}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{m.newStatus}</span>
          </span>
        ),
      };
    case "TODO_DELETED":
      return {
        icon: <Trash2 className="h-3.5 w-3.5 text-red-500" />,
        text: (
          <span>
            <strong className="text-neutral-900 dark:text-neutral-100">{actor}</strong> deleted task{" "}
            <span className="font-medium line-through text-neutral-500">&quot;{m.title || "Task"}&quot;</span>
          </span>
        ),
      };
    case "LIST_CREATED":
      return {
        icon: <Sparkles className="h-3.5 w-3.5 text-amber-500" />,
        text: (
          <span>
            <strong className="text-neutral-900 dark:text-neutral-100">{actor}</strong> created this list{" "}
            <span className="font-semibold">&quot;{m.name || "List"}&quot;</span>
          </span>
        ),
      };
    case "LIST_RENAMED":
      return {
        icon: <Edit2 className="h-3.5 w-3.5 text-amber-500" />,
        text: (
          <span>
            <strong className="text-neutral-900 dark:text-neutral-100">{actor}</strong> renamed list from{" "}
            <span className="line-through text-neutral-400">&quot;{m.previousName}&quot;</span> to{" "}
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">&quot;{m.newName}&quot;</span>
          </span>
        ),
      };
    case "INVITATION_CREATED":
      return {
        icon: <Mail className="h-3.5 w-3.5 text-purple-500" />,
        text: (
          <span>
            <strong className="text-neutral-900 dark:text-neutral-100">{actor}</strong> invited{" "}
            <span className="font-medium text-purple-600 dark:text-purple-400">{m.email}</span> as{" "}
            <span className="font-semibold">{m.role}</span>
          </span>
        ),
      };
    case "INVITATION_ACCEPTED":
      return {
        icon: <UserCheck className="h-3.5 w-3.5 text-emerald-500" />,
        text: (
          <span>
            <strong className="text-neutral-900 dark:text-neutral-100">{m.email || actor}</strong> accepted the invitation
          </span>
        ),
      };
    case "INVITATION_REVOKED":
      return {
        icon: <UserX className="h-3.5 w-3.5 text-rose-500" />,
        text: (
          <span>
            <strong className="text-neutral-900 dark:text-neutral-100">{actor}</strong> revoked invitation for{" "}
            <span className="text-neutral-500">{m.email}</span>
          </span>
        ),
      };
    case "MEMBER_JOINED":
      return {
        icon: <UserPlus className="h-3.5 w-3.5 text-emerald-500" />,
        text: (
          <span>
            <strong className="text-neutral-900 dark:text-neutral-100">{m.email || actor}</strong> joined as{" "}
            <span className="font-semibold">{m.role}</span>
          </span>
        ),
      };
    case "MEMBER_REMOVED":
      return {
        icon: <UserMinus className="h-3.5 w-3.5 text-red-500" />,
        text: (
          <span>
            <strong className="text-neutral-900 dark:text-neutral-100">{actor}</strong> removed collaborator{" "}
            <span className="text-neutral-500">{m.memberUserId ? "member" : ""}</span>
          </span>
        ),
      };
    case "MEMBER_LEFT":
      return {
        icon: <LogOut className="h-3.5 w-3.5 text-amber-500" />,
        text: (
          <span>
            <strong className="text-neutral-900 dark:text-neutral-100">{actor}</strong> left the list
          </span>
        ),
      };
    case "MEMBER_ROLE_CHANGED":
      return {
        icon: <ShieldAlert className="h-3.5 w-3.5 text-indigo-500" />,
        text: (
          <span>
            <strong className="text-neutral-900 dark:text-neutral-100">{actor}</strong> updated collaborator role to{" "}
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{m.newRole}</span>
          </span>
        ),
      };
    default:
      return {
        icon: <Clock className="h-3.5 w-3.5 text-neutral-400" />,
        text: <span>Activity recorded</span>,
      };
  }
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const config = getActivityConfig(activity);

  return (
    <div className="relative flex items-start gap-3 py-3 text-xs">
      {/* Icon Node */}
      <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        {config.icon}
      </div>

      {/* Description & Time */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
          {config.text}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400">
          <span>{formatTimestamp(activity.createdAt)}</span>
          {activity.actorEmail && (
            <>
              <span>•</span>
              <span className="truncate max-w-[140px]" title={activity.actorEmail}>
                {activity.actorEmail}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

