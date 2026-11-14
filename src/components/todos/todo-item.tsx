"use client";

import React, { useState } from "react";
import { type inferRouterOutputs } from "@trpc/server";
import { type AppRouter } from "@/server/api/root";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, Calendar, AlertCircle, RotateCcw } from "lucide-react";
import { type TodoStatusType, TODO_STATUSES } from "@/lib/validations/todo";

type RouterOutput = inferRouterOutputs<AppRouter>;
export type TodoListItem = RouterOutput["todo"]["list"][number];

interface TodoItemProps {
  todo: TodoListItem;
  listId: string;
}

export function TodoItem({ todo, listId }: TodoItemProps) {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const deleteMutation = trpc.todo.delete.useMutation({
    onSuccess: async () => {
      setDeleteError(null);
      await Promise.all([
        utils.todo.list.invalidate({ listId }),
        utils.todoList.list.invalidate(),
      ]);
    },
    onError: (err) => {
      setDeleteError(err.message || "Failed to delete task. Please try again.");
    },
  });

  const updateStatusMutation = trpc.todo.updateStatus.useMutation({
    onSuccess: async () => {
      setStatusError(null);
      await Promise.all([
        utils.todo.list.invalidate({ listId }),
        utils.todoList.list.invalidate(),
      ]);
    },
    onError: (err) => {
      setStatusError(err.message || "Failed to update status.");
    },
  });

  const handleDelete = () => {
    setDeleteError(null);
    deleteMutation.mutate({ id: todo.id });
  };

  const handleStatusChange = (newStatus: TodoStatusType) => {
    setStatusError(null);
    updateStatusMutation.mutate({ id: todo.id, status: newStatus });
  };

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(todo.createdAt));

  const isDone = todo.status === "DONE";

  const getStatusBadgeStyle = (status: TodoStatusType) => {
    switch (status) {
      case "DONE":
        return "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300 border-green-200 dark:border-green-900";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900";
      case "TODO":
      default:
        return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700";
    }
  };

  return (
    <div className={`group rounded-lg border bg-white p-3.5 transition-colors dark:bg-neutral-950 ${
      isDone
        ? "border-neutral-200/60 dark:border-neutral-800/60 opacity-80"
        : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`text-xs font-medium break-words ${
              isDone
                ? "text-neutral-500 dark:text-neutral-400 line-through"
                : "text-neutral-900 dark:text-neutral-100"
            }`}>
              {todo.title}
            </h4>

            {/* Status Selector Dropdown */}
            <div className="relative inline-block">
              <select
                value={todo.status}
                onChange={(e) => handleStatusChange(e.target.value as TodoStatusType)}
                disabled={updateStatusMutation.isPending}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded border cursor-pointer focus:outline-none transition-colors ${getStatusBadgeStyle(todo.status)}`}
                aria-label={`Change status for ${todo.title}`}
              >
                {TODO_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "IN_PROGRESS" ? "In Progress" : s === "TODO" ? "To Do" : "Done"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {todo.description && (
            <p className={`text-xs whitespace-pre-wrap break-words ${
              isDone ? "text-neutral-400 dark:text-neutral-500" : "text-neutral-600 dark:text-neutral-400"
            }`}>
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
            className="h-7 w-7 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors"
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

      {statusError && (
        <p className="text-[11px] text-red-600 dark:text-red-400 mt-1.5">{statusError}</p>
      )}

      {deleteError && (
        <div className="mt-2.5 flex items-center justify-between rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50">
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
