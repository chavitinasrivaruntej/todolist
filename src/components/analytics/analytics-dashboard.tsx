"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import type { AnalyticsRange } from "@/lib/validations/analytics";
import { VelocityChart } from "@/components/analytics/velocity-chart";
import { DistributionCards } from "@/components/analytics/distribution-cards";
import { UserMenu } from "@/components/auth/user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ListTodo,
  Download,
  RefreshCw,
  Loader2,
  Calendar,
  Info,
} from "lucide-react";

const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
];

function AnalyticsDashboardInner() {
  const searchParams = useSearchParams();
  const initialListId = searchParams.get("listId");

  const [selectedListId, setSelectedListId] = useState<string | null>(
    initialListId && initialListId.length > 0 ? initialListId : null
  );
  const [range, setRange] = useState<AnalyticsRange>("90d");
  const [exportingFormat, setExportingFormat] = useState<"csv" | "json" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data: lists = [] } = trpc.todoList.list.useQuery();

  const overviewQuery = trpc.analytics.getOverview.useQuery({
    listId: selectedListId,
  });

  const velocityQuery = trpc.analytics.getVelocity.useQuery({
    listId: selectedListId,
    range,
  });

  const isLoading = overviewQuery.isLoading || velocityQuery.isLoading;
  const isError = overviewQuery.isError || velocityQuery.isError;
  const overview = overviewQuery.data;
  const velocity = velocityQuery.data;

  const handleRetry = () => {
    overviewQuery.refetch();
    velocityQuery.refetch();
  };

  const handleExport = async (format: "csv" | "json") => {
    setExportError(null);
    setExportingFormat(format);
    try {
      const params = new URLSearchParams({ format });
      if (selectedListId) {
        params.set("listId", selectedListId);
      }

      const response = await fetch(`/api/exports/todos?${params.toString()}`, {
        method: "GET",
      });

      if (!response.ok) {
        let message = `Export failed (${response.status})`;
        try {
          const body = (await response.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // Ignore non-JSON error body
        }
        setExportError(message);
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename =
        filenameMatch?.[1] ?? `caize-todos-export.${format}`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Network error while downloading export.");
    } finally {
      setExportingFormat(null);
    }
  };

  const activeRangeLabel =
    RANGE_OPTIONS.find((o) => o.value === range)?.label ?? "Last 90 days";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 space-y-6">
      {/* Header */}
      <header className="space-y-1.5 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-neutral-50 dark:bg-neutral-50 dark:text-neutral-900">
              <BarChart3 className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Analytics &amp; Exports
            </h1>
            <Badge variant="outline" className="text-[10px] font-normal text-neutral-500">
              Phase 12
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Link href={selectedListId ? `/?listId=${selectedListId}` : "/"}>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Tasks
              </Button>
            </Link>
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Current task health, Monday-aligned weekly velocity (UTC), and secure CSV/JSON data exports.
        </p>
      </header>

      {/* Filter & Export Toolbar */}
      <section
        aria-label="Analytics filters and export controls"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 p-3.5"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          {/* List Scope Selector */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="analytics-list-scope"
              className="text-xs font-medium text-neutral-600 dark:text-neutral-400"
            >
              Scope:
            </label>
            <select
              id="analytics-list-scope"
              value={selectedListId ?? ""}
              onChange={(e) =>
                setSelectedListId(e.target.value ? e.target.value : null)
              }
              className="h-8 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400"
            >
              <option value="">All Accessible Lists</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name} ({list.effectiveRole.toLowerCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Reporting Range Selector */}
          <div
            className="inline-flex rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-0.5"
            role="group"
            aria-label="Reporting range"
          >
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRange(opt.value)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  range === opt.value
                    ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                }`}
                aria-pressed={range === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Export Actions */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={exportingFormat !== null}
            className="h-8 gap-1.5 text-xs border-neutral-300 dark:border-neutral-700"
          >
            {exportingFormat === "csv" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleExport("json")}
            disabled={exportingFormat !== null}
            className="h-8 gap-1.5 text-xs border-neutral-300 dark:border-neutral-700"
          >
            {exportingFormat === "json" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Export JSON
          </Button>
        </div>
      </section>

      {exportError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-4 py-2.5 text-xs text-red-700 dark:text-red-300"
        >
          {exportError}
        </div>
      )}

      {/* Main Content States */}
      {isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading analytics">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-neutral-100 dark:bg-neutral-900 animate-pulse"
              />
            ))}
          </div>
          <div className="h-72 rounded-xl bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 rounded-xl bg-neutral-100 dark:bg-neutral-900 animate-pulse"
              />
            ))}
          </div>
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 p-8 text-center space-y-3"
        >
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            Unable to load analytics metrics.
          </p>
          <p className="text-xs text-red-600/80 dark:text-red-400/80">
            {overviewQuery.error?.message ||
              velocityQuery.error?.message ||
              "An unexpected error occurred."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      ) : overview && velocity ? (
        <>
          {/* Scope & Reporting Metadata Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 px-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 font-medium text-neutral-700 dark:text-neutral-300">
                <Calendar className="h-3.5 w-3.5" />
                {overview.scope.type === "list"
                  ? `List: ${overview.scope.listName ?? "Selected List"}`
                  : `All Accessible Lists (${overview.scope.accessibleListCount})`}
              </span>
              <span>•</span>
              <span>Range: {activeRangeLabel}</span>
              <span>•</span>
              <span>Reporting Date: {overview.reportingDate} (UTC)</span>
            </div>
            {velocity.historicalCoverageStart && (
              <span className="inline-flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />
                Activity history available since{" "}
                {velocity.historicalCoverageStart.slice(0, 10)} (UTC)
              </span>
            )}
          </div>

          {/* Empty State if zero tasks & zero events */}
          {overview.totalTasks === 0 &&
          velocity.totalCreated === 0 &&
          velocity.totalCompletedEvents === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-10 text-center space-y-3">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-900">
                <BarChart3 className="h-5 w-5 text-neutral-500" />
              </div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                No task analytics data yet
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
                Create and complete tasks in your lists to see current-state health metrics, weekly velocity trends, and distribution breakdowns.
              </p>
              <Link href="/">
                <Button size="sm" className="mt-1">
                  Go to Tasks
                </Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Current-State Overview Summary Cards */}
              <section aria-label="Current-state task overview" className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                    <span>Total Tasks</span>
                    <ListTodo className="h-4 w-4 text-neutral-400" />
                  </div>
                  <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 tabular-nums">
                    {overview.totalTasks}
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Current non-deleted tasks
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                    <span>Currently Completed</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {overview.completedTasks}
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Current completion rate: {overview.currentCompletionRate}%
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                    <span>Open Tasks</span>
                    <Clock className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 tabular-nums">
                    {overview.openTasks}
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    To Do &amp; In Progress
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                    <span>Overdue Tasks</span>
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </div>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
                    {overview.overdueTasks}
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Open &amp; due before {overview.reportingDate}
                  </p>
                </div>
              </section>

              {/* Historical Weekly Velocity Section */}
              <section
                aria-labelledby="velocity-heading"
                className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2
                      id="velocity-heading"
                      className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
                    >
                      Historical Weekly Velocity ({activeRangeLabel})
                    </h2>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Calendar weeks starting Monday (UTC). Counts recorded creation and completion events (including reopened and recurring tasks).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900 px-3 py-1.5 border border-neutral-200/60 dark:border-neutral-800">
                      <span className="text-neutral-500 dark:text-neutral-400">Created: </span>
                      <strong className="text-indigo-600 dark:text-indigo-400 tabular-nums">
                        {velocity.totalCreated}
                      </strong>
                    </div>
                    <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900 px-3 py-1.5 border border-neutral-200/60 dark:border-neutral-800">
                      <span className="text-neutral-500 dark:text-neutral-400">Completions: </span>
                      <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {velocity.totalCompletedEvents}
                      </strong>
                    </div>
                    <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900 px-3 py-1.5 border border-neutral-200/60 dark:border-neutral-800">
                      <span className="text-neutral-500 dark:text-neutral-400">Avg / week: </span>
                      <strong className="text-neutral-900 dark:text-neutral-100 tabular-nums">
                        {velocity.averageWeeklyCompletions}
                      </strong>
                    </div>
                    <div
                      className="rounded-lg bg-neutral-50 dark:bg-neutral-900 px-3 py-1.5 border border-neutral-200/60 dark:border-neutral-800"
                      title="Directional indicator: created events minus completion events in the selected range"
                    >
                      <span className="text-neutral-500 dark:text-neutral-400">Net trend: </span>
                      <strong className="text-neutral-900 dark:text-neutral-100 tabular-nums">
                        {velocity.netActivity > 0
                          ? `+${velocity.netActivity}`
                          : velocity.netActivity}
                      </strong>
                    </div>
                  </div>
                </div>

                <VelocityChart weeks={velocity.weeks} timezone={velocity.timezone} />
              </section>

              {/* Current-State Distribution Breakdowns */}
              <DistributionCards
                totalTasks={overview.totalTasks}
                statusDistribution={overview.statusDistribution}
                priorityDistribution={overview.priorityDistribution}
                tagDistribution={overview.tagDistribution}
              />
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

export function AnalyticsDashboard() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      }
    >
      <AnalyticsDashboardInner />
    </Suspense>
  );
}
