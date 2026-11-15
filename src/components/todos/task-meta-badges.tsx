import React from "react";
import { type TodoPriority, type TodoStatus } from "@/db/schema/todos";
import {
  isTodoOverdue,
  isTodoDueToday,
  formatCalendarDate,
  getLocalTodayDateString,
} from "@/lib/todo-utils";
import { AlertCircle, Calendar, Clock } from "lucide-react";

interface PriorityBadgeProps {
  priority: TodoPriority;
  className?: string;
}

export function PriorityBadge({ priority, className = "" }: PriorityBadgeProps) {
  let style = "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700";

  switch (priority) {
    case "URGENT":
      style = "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900 font-semibold";
      break;
    case "HIGH":
      style = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900 font-medium";
      break;
    case "MEDIUM":
      style = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900";
      break;
    case "LOW":
      style = "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700";
      break;
  }

  return (
    <span
      className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border tracking-wide uppercase ${style} ${className}`}
      title={`Priority: ${priority}`}
    >
      {priority}
    </span>
  );
}

interface DueDateBadgeProps {
  dueDate?: string | null;
  status: TodoStatus;
  clientToday?: string;
  className?: string;
}

export function DueDateBadge({
  dueDate,
  status,
  clientToday = getLocalTodayDateString(),
  className = "",
}: DueDateBadgeProps) {
  if (!dueDate) return null;

  const overdue = isTodoOverdue({ status, dueDate }, clientToday);
  const dueToday = isTodoDueToday({ dueDate }, clientToday);
  const formatted = formatCalendarDate(dueDate);
  const isDone = status === "DONE";

  if (isDone) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] text-neutral-400 dark:text-neutral-500 ${className}`}
        title={`Due: ${formatted} (Completed)`}
      >
        <Calendar className="h-3 w-3" />
        <span>Due {formatted}</span>
      </span>
    );
  }

  if (overdue) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900 ${className}`}
        title={`Overdue since ${formatted}`}
      >
        <AlertCircle className="h-3 w-3 text-red-500" />
        <span>Overdue ({formatted})</span>
      </span>
    );
  }

  if (dueToday) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900 ${className}`}
        title="Due today"
      >
        <Clock className="h-3 w-3 text-amber-600" />
        <span>Due today</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400 ${className}`}
      title={`Due: ${formatted}`}
    >
      <Calendar className="h-3 w-3" />
      <span>Due {formatted}</span>
    </span>
  );
}

