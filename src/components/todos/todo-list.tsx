"use client";

import React, { useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { TodoItem } from "@/components/todos/todo-item";
import { Button } from "@/components/ui/button";
import { CheckSquare, AlertCircle, RefreshCw } from "lucide-react";
import type { TaskFilterState } from "@/components/todos/task-filter-bar";

interface TodoListProps {
  listId: string;
  isReadOnly?: boolean;
  filters?: TaskFilterState;
  onTaskCountChange?: (count: number) => void;
}

export function TodoList({
  listId,
  isReadOnly = false,
  filters,
  onTaskCountChange,
}: TodoListProps) {
  const queryInput = {
    listId,
    search: filters?.search?.trim() ? filters.search.trim() : undefined,
    priority: filters?.priority,
    dueFilter: filters?.dueFilter,
    sortBy: filters?.sortBy,
    sortDirection: filters?.sortDirection,
  };

  const {
    data: todos,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.todo.list.useQuery(queryInput);

  useEffect(() => {
    if (todos && onTaskCountChange) {
      onTaskCountChange(todos.length);
    }
  }, [todos, onTaskCountChange]);

  if (isLoading) {
    return (
      <div className="space-y-2.5 pt-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 w-full animate-pulse rounded-lg border border-neutral-100 bg-neutral-50/80 dark:border-neutral-800/80 dark:bg-neutral-900/40"
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
          Failed to load tasks
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

  if (!todos || todos.length === 0) {
    const isFiltered =
      Boolean(filters?.search?.trim()) ||
      Boolean(filters?.priority) ||
      (filters?.dueFilter && filters.dueFilter !== "ALL");

    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 p-8 text-center dark:border-neutral-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 mb-2 text-neutral-400">
          <CheckSquare className="h-4 w-4" />
        </div>
        <h4 className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
          {isFiltered ? "No tasks matching filter criteria" : "No tasks in this list yet"}
        </h4>
        <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          {isFiltered
            ? "Try resetting or adjusting your search and filter parameters."
            : "Add a task above to organize your work in this list."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between pb-1">
        <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
          Tasks ({todos.length})
        </span>
      </div>
      <div className="space-y-2">
        {todos.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            listId={listId}
            isReadOnly={isReadOnly}
          />
        ))}
      </div>
    </div>
  );
}
