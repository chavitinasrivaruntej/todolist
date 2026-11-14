"use client";

import React from "react";
import { trpc } from "@/lib/trpc/client";
import { TodoItem } from "@/components/todos/todo-item";
import { Button } from "@/components/ui/button";
import { CheckSquare, AlertCircle, RefreshCw } from "lucide-react";

export function TodoList() {
  const { data: todos, isLoading, isError, error, refetch } = trpc.todo.list.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-3 pt-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 w-full animate-pulse rounded-lg border border-neutral-100 bg-neutral-50/80 dark:border-neutral-800/80 dark:bg-neutral-900/40"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50/40 p-8 text-center dark:border-red-900/40 dark:bg-red-950/20">
        <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Failed to load todos
        </h4>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 max-w-sm">
          {error.message || "An unexpected error occurred while communicating with the server."}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="mt-4 gap-1.5 text-xs"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Retry</span>
        </Button>
      </div>
    );
  }

  if (!todos || todos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 p-12 text-center dark:border-neutral-800">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 mb-3 text-neutral-400">
          <CheckSquare className="h-5 w-5" />
        </div>
        <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          No todos yet
        </h4>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Create your first task above to populate your workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between pb-1">
        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
          Tasks ({todos.length})
        </span>
      </div>
      <div className="space-y-2">
        {todos.map((todo) => (
          <TodoItem key={todo.id} todo={todo} />
        ))}
      </div>
    </div>
  );
}
