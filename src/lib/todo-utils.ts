import type { TodoStatus, TodoPriority } from "@/db/schema/todos";

/**
 * Returns today's calendar date formatted as "YYYY-MM-DD" in the user's local timezone.
 */
export function getLocalTodayDateString(): string {
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      // Fallback below
    }
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Invariant overdue check:
 * - TODO with a past due date: Overdue
 * - IN_PROGRESS with a past due date: Overdue
 * - DONE with a past due date: Not overdue
 * - Due today: Not overdue
 * - No due date: Never overdue
 */
export function isTodoOverdue(
  todo: { status: TodoStatus; dueDate?: string | null },
  referenceDateString: string = getLocalTodayDateString()
): boolean {
  if (todo.status === "DONE" || !todo.dueDate) {
    return false;
  }
  return todo.dueDate < referenceDateString;
}

/**
 * Check if a task is due today.
 */
export function isTodoDueToday(
  todo: { dueDate?: string | null },
  referenceDateString: string = getLocalTodayDateString()
): boolean {
  if (!todo.dueDate) return false;
  return todo.dueDate === referenceDateString;
}

/**
 * Format a calendar date string (YYYY-MM-DD) for display without timezone shifting.
 */
export function formatCalendarDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;

  const [yearStr, monthStr, dayStr] = parts;
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  if (monthIndex >= 0 && monthIndex < 12 && !isNaN(day) && !isNaN(year)) {
    return `${months[monthIndex]} ${day}, ${year}`;
  }

  return dateStr;
}

/**
 * Priority display order for UI sorting and ranking:
 * URGENT (4) > HIGH (3) > MEDIUM (2) > LOW (1)
 */
export const PRIORITY_WEIGHTS: Record<TodoPriority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

