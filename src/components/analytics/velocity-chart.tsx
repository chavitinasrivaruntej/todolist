"use client";

import React, { useState } from "react";
import type { WeeklyVelocityPoint } from "@/lib/validations/analytics";
import { Button } from "@/components/ui/button";
import { Table, BarChart3 } from "lucide-react";

interface VelocityChartProps {
  weeks: WeeklyVelocityPoint[];
  timezone: "UTC";
}

export function VelocityChart({ weeks, timezone }: VelocityChartProps) {
  const [showTable, setShowTable] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (weeks.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-neutral-500 dark:text-neutral-400">
        No calendar weeks available for the selected range.
      </div>
    );
  }

  const maxCount = Math.max(
    1,
    ...weeks.map((w) => Math.max(w.createdCount, w.completedCount))
  );

  const chartHeight = 200;
  const chartWidth = Math.max(560, weeks.length * 44);
  const paddingLeft = 36;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 34;
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const groupWidth = plotWidth / weeks.length;
  const barWidth = Math.min(16, Math.max(5, Math.floor((groupWidth - 8) / 2)));

  // Show at most ~8 x-axis labels so they don't overlap on 12m (53 weeks)
  const labelStep = Math.max(1, Math.ceil(weeks.length / 8));

  const yTicks = [0, Math.ceil(maxCount / 2), maxCount].filter(
    (v, idx, arr) => arr.indexOf(v) === idx
  );

  const activePoint = hoveredIdx !== null ? weeks[hoveredIdx] : null;

  return (
    <div className="space-y-3">
      {/* Legend & Table Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-xs text-neutral-600 dark:text-neutral-400">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm bg-indigo-500 dark:bg-indigo-400"
              aria-hidden="true"
            />
            Created tasks
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-400"
              aria-hidden="true"
            />
            Completion events
          </span>
        </div>

        <div className="flex items-center gap-2">
          {activePoint && (
            <span
              className="text-[11px] text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded"
              aria-live="polite"
            >
              Week of {activePoint.weekStart} ({timezone}):{" "}
              <strong>{activePoint.createdCount}</strong> created,{" "}
              <strong>{activePoint.completedCount}</strong> completed
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowTable((prev) => !prev)}
            className="h-7 px-2 text-xs gap-1"
            aria-expanded={showTable}
          >
            {showTable ? (
              <>
                <BarChart3 className="h-3.5 w-3.5" />
                Chart view
              </>
            ) : (
              <>
                <Table className="h-3.5 w-3.5" />
                Table view
              </>
            )}
          </Button>
        </div>
      </div>

      {!showTable ? (
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-52 min-w-[480px]"
            role="img"
            aria-label={`Weekly created versus completed tasks bar chart across ${weeks.length} calendar weeks in ${timezone}`}
          >
            {/* Horizontal grid lines */}
            {yTicks.map((tick) => {
              const y =
                paddingTop + plotHeight - (tick / maxCount) * plotHeight;
              return (
                <g key={tick}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={chartWidth - paddingRight}
                    y2={y}
                    className="stroke-neutral-200 dark:stroke-neutral-800"
                    strokeDasharray={tick === 0 ? undefined : "3 3"}
                  />
                  <text
                    x={paddingLeft - 6}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-neutral-400 dark:fill-neutral-500 text-[10px]"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* Week bar groups */}
            {weeks.map((week, idx) => {
              const centerX = paddingLeft + idx * groupWidth + groupWidth / 2;
              const createdHeight = (week.createdCount / maxCount) * plotHeight;
              const completedHeight = (week.completedCount / maxCount) * plotHeight;
              const createdY = paddingTop + plotHeight - createdHeight;
              const completedY = paddingTop + plotHeight - completedHeight;

              return (
                <g
                  key={week.weekStart}
                  tabIndex={0}
                  role="group"
                  aria-label={`Week of ${week.weekStart}: ${week.createdCount} created, ${week.completedCount} completed`}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onFocus={() => setHoveredIdx(idx)}
                  onBlur={() => setHoveredIdx(null)}
                  className="outline-none cursor-pointer"
                >
                  <rect
                    x={paddingLeft + idx * groupWidth}
                    y={paddingTop}
                    width={groupWidth}
                    height={plotHeight}
                    fill="transparent"
                  />
                  {/* Created bar */}
                  <rect
                    x={centerX - barWidth - 1}
                    y={createdY}
                    width={barWidth}
                    height={Math.max(createdHeight, week.createdCount > 0 ? 2 : 0)}
                    rx={2}
                    className="fill-indigo-500 dark:fill-indigo-400 transition-opacity hover:opacity-80"
                  />
                  {/* Completed bar */}
                  <rect
                    x={centerX + 1}
                    y={completedY}
                    width={barWidth}
                    height={Math.max(completedHeight, week.completedCount > 0 ? 2 : 0)}
                    rx={2}
                    className="fill-emerald-500 dark:fill-emerald-400 transition-opacity hover:opacity-80"
                  />

                  {idx % labelStep === 0 && (
                    <text
                      x={centerX}
                      y={chartHeight - 10}
                      textAnchor="middle"
                      className="fill-neutral-500 dark:fill-neutral-400 text-[10px]"
                    >
                      {week.weekLabel}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
              <tr>
                <th className="px-3 py-2 font-medium">Week Starting (Mon, {timezone})</th>
                <th className="px-3 py-2 font-medium text-right">Created</th>
                <th className="px-3 py-2 font-medium text-right">Completion Events</th>
                <th className="px-3 py-2 font-medium text-right">Net Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {weeks.map((week) => (
                <tr key={week.weekStart} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/40">
                  <td className="px-3 py-1.5 font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                    {week.weekStart}
                  </td>
                  <td className="px-3 py-1.5 text-right text-indigo-600 dark:text-indigo-400 font-medium">
                    {week.createdCount}
                  </td>
                  <td className="px-3 py-1.5 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                    {week.completedCount}
                  </td>
                  <td className="px-3 py-1.5 text-right text-neutral-600 dark:text-neutral-400">
                    {week.netActivity > 0 ? `+${week.netActivity}` : week.netActivity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
