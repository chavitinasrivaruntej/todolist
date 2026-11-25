"use client";

import React from "react";
import type {
  StatusDistributionItem,
  PriorityDistributionItem,
  TagDistributionItem,
} from "@/lib/validations/analytics";
import type { TodoPriority, TodoStatus } from "@/db/schema/todos";

interface DistributionCardsProps {
  totalTasks: number;
  statusDistribution: StatusDistributionItem[];
  priorityDistribution: PriorityDistributionItem[];
  tagDistribution: TagDistributionItem[];
}

const STATUS_META: Record<
  TodoStatus,
  { label: string; barClass: string }
> = {
  TODO: { label: "To Do", barClass: "bg-neutral-500 dark:bg-neutral-400" },
  IN_PROGRESS: { label: "In Progress", barClass: "bg-amber-500 dark:bg-amber-400" },
  DONE: { label: "Done", barClass: "bg-emerald-500 dark:bg-emerald-400" },
};

const PRIORITY_META: Record<
  TodoPriority,
  { label: string; barClass: string }
> = {
  URGENT: { label: "Urgent", barClass: "bg-red-500 dark:bg-red-400" },
  HIGH: { label: "High", barClass: "bg-orange-500 dark:bg-orange-400" },
  MEDIUM: { label: "Medium", barClass: "bg-blue-500 dark:bg-blue-400" },
  LOW: { label: "Low", barClass: "bg-slate-400 dark:bg-slate-500" },
};

const TAG_DOT_COLORS: Record<string, string> = {
  slate: "bg-slate-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
};

export function DistributionCards({
  totalTasks,
  statusDistribution,
  priorityDistribution,
  tagDistribution,
}: DistributionCardsProps) {
  const maxTagCount = Math.max(1, ...tagDistribution.map((t) => t.count));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Status Distribution */}
      <section
        className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 space-y-3"
        aria-labelledby="status-dist-heading"
      >
        <div>
          <h3
            id="status-dist-heading"
            className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
          >
            Status Distribution
          </h3>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Current tasks grouped by workflow status
          </p>
        </div>

        <ul className="space-y-2.5">
          {statusDistribution.map((item) => {
            const meta = STATUS_META[item.status];
            const pct = totalTasks > 0 ? Math.round((item.count / totalTasks) * 100) : 0;
            return (
              <li key={item.status} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                    {meta.label}
                  </span>
                  <span className="text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {item.count} ({pct}%)
                  </span>
                </div>
                <div
                  className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-900 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${meta.label}: ${item.count} tasks (${pct}%)`}
                >
                  <div
                    className={`h-full rounded-full ${meta.barClass} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Priority Distribution */}
      <section
        className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 space-y-3"
        aria-labelledby="priority-dist-heading"
      >
        <div>
          <h3
            id="priority-dist-heading"
            className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
          >
            Priority Distribution
          </h3>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Current tasks grouped by priority level
          </p>
        </div>

        <ul className="space-y-2.5">
          {priorityDistribution.map((item) => {
            const meta = PRIORITY_META[item.priority];
            const pct = totalTasks > 0 ? Math.round((item.count / totalTasks) * 100) : 0;
            return (
              <li key={item.priority} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                    {meta.label}
                  </span>
                  <span className="text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {item.count} ({pct}%)
                  </span>
                </div>
                <div
                  className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-900 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${meta.label} priority: ${item.count} tasks (${pct}%)`}
                >
                  <div
                    className={`h-full rounded-full ${meta.barClass} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Tag Breakdown */}
      <section
        className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 space-y-3"
        aria-labelledby="tag-dist-heading"
      >
        <div>
          <h3
            id="tag-dist-heading"
            className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
          >
            Tag Breakdown
          </h3>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Tasks with multiple tags count toward each applicable tag.
          </p>
        </div>

        {tagDistribution.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
            No tagged tasks in this scope.
          </div>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {tagDistribution.map((tag) => {
              const barPct = Math.round((tag.count / maxTagCount) * 100);
              const dotClass = TAG_DOT_COLORS[tag.color] ?? "bg-neutral-500";
              return (
                <li key={tag.tagId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="inline-flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 font-medium truncate">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{tag.name}</span>
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400 tabular-nums shrink-0">
                      {tag.count}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-900 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${dotClass} opacity-80`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
