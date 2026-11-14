"use client";

import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import { KanbanColumn } from "@/components/todos/kanban/kanban-column";
import { Button } from "@/components/ui/button";
import { type TodoStatusType } from "@/lib/validations/todo";
import { AlertCircle, RefreshCw, CheckSquare } from "lucide-react";

interface KanbanBoardProps {
  listId: string;
}

export function KanbanBoard({ listId }: KanbanBoardProps) {
  const [mobileTab, setMobileTab] = useState<TodoStatusType>("TODO");

  const {
    data: todos,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.todo.list.useQuery({ listId });

  const columns = useMemo(() => {
    return {
      TODO: todos?.filter((t) => t.status === "TODO") ?? [],
      IN_PROGRESS: todos?.filter((t) => t.status === "IN_PROGRESS") ?? [],
      DONE: todos?.filter((t) => t.status === "DONE") ?? [],
    };
  }, [todos]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-80 w-full animate-pulse rounded-xl border border-neutral-100 bg-neutral-50/80 dark:border-neutral-800/80 dark:bg-neutral-900/40"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50/40 p-6 text-center dark:border-red-900/40 dark:bg-red-950/20">
        <AlertCircle className="h-6 w-6 text-red-500 mb-1.5" />
        <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
          Failed to load board tasks
        </h4>
        <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 max-w-sm">
          {error.message || "An unexpected error occurred while communicating with the server."}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="mt-3 gap-1.5 text-xs h-7"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Retry</span>
        </Button>
      </div>
    );
  }

  const totalTasks = todos?.length ?? 0;

  if (totalTasks === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 p-8 text-center dark:border-neutral-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 mb-2 text-neutral-400">
          <CheckSquare className="h-4 w-4" />
        </div>
        <h4 className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
          No tasks in this list yet
        </h4>
        <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          Add a task above to populate your Kanban board columns.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mobile Column Navigation Tabs (visible only on mobile viewports < md) */}
      <div
        className="flex md:hidden items-center justify-between rounded-lg border border-neutral-200 bg-neutral-100/70 p-1 dark:border-neutral-800 dark:bg-neutral-900/60"
        role="tablist"
        aria-label="Kanban status column tabs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "TODO"}
          onClick={() => setMobileTab("TODO")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center ${
            mobileTab === "TODO"
              ? "bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-neutral-50 font-semibold"
              : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400"
          }`}
        >
          To Do ({columns.TODO.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "IN_PROGRESS"}
          onClick={() => setMobileTab("IN_PROGRESS")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center ${
            mobileTab === "IN_PROGRESS"
              ? "bg-white text-blue-700 shadow-xs dark:bg-neutral-800 dark:text-blue-300 font-semibold"
              : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400"
          }`}
        >
          In Progress ({columns.IN_PROGRESS.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "DONE"}
          onClick={() => setMobileTab("DONE")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center ${
            mobileTab === "DONE"
              ? "bg-white text-green-700 shadow-xs dark:bg-neutral-800 dark:text-green-300 font-semibold"
              : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400"
          }`}
        >
          Done ({columns.DONE.length})
        </button>
      </div>

      {/* Kanban Columns Grid (On desktop: 3-column grid; On mobile: shows active mobileTab column) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`md:block ${mobileTab === "TODO" ? "block" : "hidden"}`}>
          <KanbanColumn
            status="TODO"
            title="To Do"
            todos={columns.TODO}
            listId={listId}
          />
        </div>

        <div className={`md:block ${mobileTab === "IN_PROGRESS" ? "block" : "hidden"}`}>
          <KanbanColumn
            status="IN_PROGRESS"
            title="In Progress"
            todos={columns.IN_PROGRESS}
            listId={listId}
          />
        </div>

        <div className={`md:block ${mobileTab === "DONE" ? "block" : "hidden"}`}>
          <KanbanColumn
            status="DONE"
            title="Done"
            todos={columns.DONE}
            listId={listId}
          />
        </div>
      </div>
    </div>
  );
}
