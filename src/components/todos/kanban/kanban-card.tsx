"use client";

import React, { useState } from "react";
import { type inferRouterOutputs } from "@trpc/server";
import { type AppRouter } from "@/server/api/root";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  Loader2,
  Calendar,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Undo2,
} from "lucide-react";
import { type TodoStatusType } from "@/lib/validations/todo";

type RouterOutput = inferRouterOutputs<AppRouter>;
export type TodoListItem = RouterOutput["todo"]["list"][number];

interface KanbanCardProps {
  todo: TodoListItem;
  listId: string;
}

export function KanbanCard({ todo, listId }: KanbanCardProps) {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [failedTargetStatus, setFailedTargetStatus] = useState<TodoStatusType | null>(null);

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
      setFailedTargetStatus(null);
      await Promise.all([
        utils.todo.list.invalidate({ listId }),
        utils.todoList.list.invalidate(),
      ]);
    },
    onError: (err, variables) => {
      setStatusError(err.message || "Failed to move task. Please try again.");
      setFailedTargetStatus(variables.status);
    },
  });

  const handleDelete = () => {
    setDeleteError(null);
    deleteMutation.mutate({ id: todo.id });
  };

  const handleMoveTo = (newStatus: TodoStatusType) => {
    setStatusError(null);
    setFailedTargetStatus(null);
    updateStatusMutation.mutate({ id: todo.id, status: newStatus });
  };

  const handleRetryStatus = () => {
    if (failedTargetStatus) {
      handleMoveTo(failedTargetStatus);
    }
  };

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(todo.createdAt));

  const isDone = todo.status === "DONE";

  return (
    <div
      className={`group rounded-lg border bg-white p-3 shadow-2xs transition-all dark:bg-neutral-950 ${
        isDone
          ? "border-neutral-200/60 dark:border-neutral-800/60 opacity-85"
          : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
      }`}
    >
      {/* Title & Delete Action */}
      <div className="flex items-start justify-between gap-2">
        <h4
          className={`text-xs font-medium break-words flex-1 ${
            isDone
              ? "text-neutral-500 dark:text-neutral-400 line-through"
              : "text-neutral-900 dark:text-neutral-100"
          }`}
        >
          {todo.title}
        </h4>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={deleteMutation.isPending || updateStatusMutation.isPending}
          className="h-6 w-6 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:hover:text-red-400 -mr-1 -mt-1 flex-shrink-0"
          title="Delete task"
          aria-label={`Delete task: ${todo.title}`}
        >
          {deleteMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin text-red-500" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Description */}
      {todo.description && (
        <p
          className={`mt-1 text-[11px] whitespace-pre-wrap break-words ${
            isDone
              ? "text-neutral-400 dark:text-neutral-500"
              : "text-neutral-600 dark:text-neutral-400"
          }`}
        >
          {todo.description}
        </p>
      )}

      {/* Creation Date */}
      <div className="flex items-center gap-1.5 pt-2 text-[10px] text-neutral-400 dark:text-neutral-500">
        <Calendar className="h-3 w-3" />
        <span>{formattedDate}</span>
      </div>

      {/* Status Update Error & Retry */}
      {statusError && (
        <div className="mt-2 flex items-center justify-between rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50">
          <div className="flex items-center gap-1 min-w-0">
            <AlertCircle className="h-3 w-3 flex-shrink-0 text-red-500" />
            <span className="truncate">{statusError}</span>
          </div>
          {failedTargetStatus && (
            <button
              type="button"
              onClick={handleRetryStatus}
              disabled={updateStatusMutation.isPending}
              className="flex items-center gap-1 font-medium underline hover:no-underline ml-1.5 flex-shrink-0 text-[10px]"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* Delete Error & Retry */}
      {deleteError && (
        <div className="mt-2 flex items-center justify-between rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50">
          <div className="flex items-center gap-1 min-w-0">
            <AlertCircle className="h-3 w-3 flex-shrink-0 text-red-500" />
            <span className="truncate">{deleteError}</span>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-1 font-medium underline hover:no-underline ml-1.5 flex-shrink-0 text-[10px]"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Quick Status Transition Actions */}
      <div className="mt-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-900 flex items-center justify-between gap-1 flex-wrap">
        {todo.status === "TODO" && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMoveTo("IN_PROGRESS")}
              disabled={updateStatusMutation.isPending}
              className="h-6 px-2 text-[10px] gap-1 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/40"
              title="Move to In Progress"
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : (
                <ArrowRight className="h-2.5 w-2.5" />
              )}
              <span>In Progress</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMoveTo("DONE")}
              disabled={updateStatusMutation.isPending}
              className="h-6 px-2 text-[10px] gap-1 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900 hover:bg-green-50 dark:hover:bg-green-950/40 ml-auto"
              title="Mark as Done"
            >
              <CheckCircle2 className="h-2.5 w-2.5" />
              <span>Done</span>
            </Button>
          </>
        )}

        {todo.status === "IN_PROGRESS" && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMoveTo("TODO")}
              disabled={updateStatusMutation.isPending}
              className="h-6 px-2 text-[10px] gap-1 text-neutral-600 dark:text-neutral-400"
              title="Move back to To Do"
            >
              <ArrowLeft className="h-2.5 w-2.5" />
              <span>To Do</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMoveTo("DONE")}
              disabled={updateStatusMutation.isPending}
              className="h-6 px-2 text-[10px] gap-1 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900 hover:bg-green-50 dark:hover:bg-green-950/40 ml-auto"
              title="Mark as Done"
            >
              <CheckCircle2 className="h-2.5 w-2.5" />
              <span>Done</span>
            </Button>
          </>
        )}

        {todo.status === "DONE" && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMoveTo("TODO")}
              disabled={updateStatusMutation.isPending}
              className="h-6 px-2 text-[10px] gap-1 text-neutral-600 dark:text-neutral-400"
              title="Reopen to To Do"
            >
              <Undo2 className="h-2.5 w-2.5" />
              <span>Reopen</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMoveTo("IN_PROGRESS")}
              disabled={updateStatusMutation.isPending}
              className="h-6 px-2 text-[10px] gap-1 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 ml-auto"
              title="Move back to In Progress"
            >
              <ArrowLeft className="h-2.5 w-2.5" />
              <span>In Progress</span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
