"use client";

import React, { useState } from "react";
import { type inferRouterOutputs } from "@trpc/server";
import { type AppRouter } from "@/server/api/root";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, Calendar, AlertCircle, RotateCcw } from "lucide-react";

type RouterOutput = inferRouterOutputs<AppRouter>;
export type TodoListItem = RouterOutput["todo"]["list"][number];

interface TodoItemProps {
  todo: TodoListItem;
}

export function TodoItem({ todo }: TodoItemProps) {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const deleteMutation = trpc.todo.delete.useMutation({
    onSuccess: async () => {
      setDeleteError(null);
      await utils.todo.list.invalidate();
    },
    onError: (err) => {
      setDeleteError(err.message || "Failed to delete task. Please try again.");
    },
  });

  const handleDelete = () => {
    setDeleteError(null);
    deleteMutation.mutate({ id: todo.id });
  };

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(todo.createdAt));

  return (
    <div className="group rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700">
      <div className="flex items-start justify-between">
        <div className="space-y-1 pr-4 min-w-0 flex-1">
          <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 break-words">
            {todo.title}
          </h4>
          {todo.description && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap break-words">
              {todo.description}
            </p>
          )}
          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
            <Calendar className="h-3 w-3" />
            <span>Created {formattedDate}</span>
          </div>
        </div>

        <div className="flex-shrink-0 pt-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="h-8 w-8 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors"
            title="Delete todo"
            aria-label={`Delete todo: ${todo.title}`}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {deleteError && (
        <div className="mt-3 flex items-center justify-between rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />
            <span>{deleteError}</span>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-1 font-medium underline hover:no-underline ml-2 flex-shrink-0"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        </div>
      )}
    </div>
  );
}
