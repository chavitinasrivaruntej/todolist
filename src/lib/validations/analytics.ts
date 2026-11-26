import { z } from "zod";
import type { TodoStatus, TodoPriority } from "@/db/schema/todos";

export const analyticsRangeSchema = z.enum(["7d", "30d", "90d", "12m"]);
export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;

export const getAnalyticsOverviewInputSchema = z.object({
  listId: z.string().uuid("Invalid list ID format").nullable().optional(),
});
export type GetAnalyticsOverviewInput = z.infer<typeof getAnalyticsOverviewInputSchema>;

export const getAnalyticsVelocityInputSchema = z.object({
  listId: z.string().uuid("Invalid list ID format").nullable().optional(),
  range: analyticsRangeSchema.default("90d"),
});
export type GetAnalyticsVelocityInput = z.infer<typeof getAnalyticsVelocityInputSchema>;

export const exportFormatSchema = z.enum(["csv", "json"]);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

export const exportTodosQuerySchema = z.object({
  format: exportFormatSchema,
  listId: z.string().uuid("Invalid list ID format").optional(),
});
export type ExportTodosQuery = z.infer<typeof exportTodosQuerySchema>;

export interface AnalyticsScopeInfo {
  type: "list" | "all-accessible-lists";
  listId: string | null;
  listName: string | null;
  accessibleListCount: number;
}

export interface StatusDistributionItem {
  status: TodoStatus;
  count: number;
}

export interface PriorityDistributionItem {
  priority: TodoPriority;
  count: number;
}

export interface TagDistributionItem {
  tagId: string;
  name: string;
  color: string;
  count: number;
}

export interface AnalyticsOverviewResult {
  scope: AnalyticsScopeInfo;
  reportingDate: string; // YYYY-MM-DD in UTC
  reportingTimezone: "UTC";
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
  overdueTasks: number;
  /** Current-state ratio (completedTasks / totalTasks * 100), NOT historical velocity. Safe 0 for empty dataset. */
  currentCompletionRate: number;
  statusDistribution: StatusDistributionItem[];
  priorityDistribution: PriorityDistributionItem[];
  tagDistribution: TagDistributionItem[];
}

export interface WeeklyVelocityPoint {
  weekStart: string; // YYYY-MM-DD (Monday in UTC)
  weekLabel: string; // e.g. "Nov 18"
  createdCount: number;
  completedCount: number;
  /** Directional indicator (createdCount - completedCount), NOT actual backlog */
  netActivity: number;
}

export interface AnalyticsVelocityResult {
  scope: Omit<AnalyticsScopeInfo, "accessibleListCount">;
  range: AnalyticsRange;
  timezone: "UTC";
  rangeStart: string; // ISO-8601 UTC
  rangeEnd: string; // ISO-8601 UTC (exclusive)
  historicalCoverageStart: string | null; // Earliest activity log timestamp in scope
  totalCreated: number;
  totalCompletedEvents: number;
  averageWeeklyCompletions: number;
  /** Directional indicator (totalCreated - totalCompletedEvents), NOT actual backlog */
  netActivity: number;
  weeks: WeeklyVelocityPoint[];
}

export interface ExportedTodoRecurrence {
  ruleId: string;
  occurrenceNumber: number | null;
  frequency: string;
  interval: number;
}

export interface ExportedTodoTag {
  id: string;
  name: string;
  color: string;
}

export interface ExportedTodoItem {
  id: string;
  title: string;
  description: string | null;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  listId: string;
  listName: string;
  tags: ExportedTodoTag[];
  recurrence: ExportedTodoRecurrence | null;
}
