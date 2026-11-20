"use client";

import React, { useState } from "react";
import { type inferRouterOutputs } from "@trpc/server";
import { type AppRouter } from "@/server/api/root";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Trash2,
  Loader2,
  Calendar,
  AlertCircle,
  RotateCcw,
  Edit2,
  Check,
  X,
  Paperclip,
} from "lucide-react";
import {
  type TodoStatusType,
  type TodoPriorityType,
  TODO_STATUSES,
  TODO_PRIORITIES,
} from "@/lib/validations/todo";
import { PriorityBadge, DueDateBadge } from "@/components/todos/task-meta-badges";
import { RecurrenceBadge } from "@/components/recurrence/recurrence-badge";
import { TagBadge } from "@/components/tags/tag-badge";
import { TagSelector } from "@/components/tags/tag-selector";
import { AttachmentCountBadge } from "@/components/todos/attachments/attachment-count-badge";
import { TaskAttachmentsPanel } from "@/components/todos/attachments/task-attachments-panel";

type RouterOutput = inferRouterOutputs<AppRouter>;
export type TodoListItem = RouterOutput["todo"]["list"][number];

interface TodoItemProps {
  todo: TodoListItem;
  listId: string;
  isReadOnly?: boolean;
}

export function TodoItem({ todo, listId, isReadOnly = false }: TodoItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [editDescription, setEditDescription] = useState(todo.description || "");
  const [editPriority, setEditPriority] = useState<TodoPriorityType>(todo.priority);
  const [editDueDate, setEditDueDate] = useState<string>(todo.dueDate || "");
  const [editTagIds, setEditTagIds] = useState<string[]>(todo.tags?.map((t) => t.id) || []);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [showAttachments, setShowAttachments] = useState(false);

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

  const updateDetailsMutation = trpc.todo.updateDetails.useMutation({
    onSuccess: async () => {
      setEditError(null);
      setIsEditing(false);
      await Promise.all([
        utils.todo.list.invalidate({ listId }),
        utils.todoList.list.invalidate(),
      ]);
    },
    onError: (err) => {
      setEditError(err.message || "Failed to save task details.");
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

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setEditError("Title cannot be empty.");
      return;
    }
    setEditError(null);
    updateDetailsMutation.mutate({
      id: todo.id,
      title: trimmedTitle,
      description: editDescription.trim() ? editDescription.trim() : null,
      priority: editPriority,
      dueDate: editDueDate ? editDueDate : null,
      tagIds: editTagIds,
    });
  };

  const handleCancelEdit = () => {
    setEditTitle(todo.title);
    setEditDescription(todo.description || "");
    setEditPriority(todo.priority);
    setEditDueDate(todo.dueDate || "");
    setEditTagIds(todo.tags?.map((t) => t.id) || []);
    setEditError(null);
    setIsEditing(false);
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
        return "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700";
    }
  };

  return (
    <div
      className={`rounded-lg border p-3.5 transition-colors ${
        isDone
          ? "border-neutral-200/60 bg-neutral-50/50 dark:border-neutral-800/60 dark:bg-neutral-900/20"
          : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-2xs"
      }`}
    >
      {/* Inline Editing Form */}
      {isEditing ? (
        <form onSubmit={handleSaveEdit} className="space-y-2.5">
          <div>
            <label className="block text-[11px] font-medium text-neutral-500 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              disabled={updateDetailsMutation.isPending}
              maxLength={255}
              className="text-xs h-8"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-500 mb-1">
              Description
            </label>
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              disabled={updateDetailsMutation.isPending}
              rows={2}
              maxLength={1000}
              className="text-xs resize-none"
              placeholder="Add description..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                Priority
              </label>
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value as TodoPriorityType)}
                disabled={updateDetailsMutation.isPending}
                className="h-8 w-full rounded border border-neutral-200 bg-white px-2 text-xs shadow-2xs focus-visible:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
              >
                {TODO_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                Due Date
              </label>
              <Input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                disabled={updateDetailsMutation.isPending}
                className="text-xs h-8"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-500 mb-1">
              Tags
            </label>
            <TagSelector
              listId={listId}
              selectedTagIds={editTagIds}
              onChange={setEditTagIds}
            />
          </div>

          {editError && (
            <p className="text-[11px] text-red-600 dark:text-red-400">{editError}</p>
          )}

          {/* Attachments Section in Edit Mode */}
          <TaskAttachmentsPanel
            todoId={todo.id}
            listId={listId}
            isReadOnly={isReadOnly}
          />

          <div className="flex justify-end gap-1.5 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancelEdit}
              disabled={updateDetailsMutation.isPending}
              className="h-7 text-xs px-2"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={updateDetailsMutation.isPending || !editTitle.trim()}
              className="h-7 text-xs px-2"
            >
              {updateDetailsMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Save
                </>
              )}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4
                className={`text-xs font-medium break-words ${
                  isDone
                    ? "text-neutral-500 dark:text-neutral-400 line-through"
                    : "text-neutral-900 dark:text-neutral-100"
                }`}
              >
                {todo.title}
              </h4>

              {/* Priority Badge */}
              <PriorityBadge priority={todo.priority} />

              {/* Due Date Badge */}
              <DueDateBadge dueDate={todo.dueDate} status={todo.status} />

              {/* Recurrence Badge */}
              {todo.recurrenceRuleId && (
                <RecurrenceBadge occurrenceNumber={todo.occurrenceNumber} />
              )}

              {/* Attachment Count Badge */}
              <AttachmentCountBadge count={todo.attachmentCount} />

              {/* Status Indicator / Dropdown */}
              {isReadOnly ? (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusBadgeStyle(
                    todo.status
                  )}`}
                >
                  {todo.status === "IN_PROGRESS"
                    ? "In Progress"
                    : todo.status === "TODO"
                    ? "To Do"
                    : "Done"}
                </span>
              ) : (
                <div className="relative inline-block">
                  <select
                    value={todo.status}
                    onChange={(e) =>
                      handleStatusChange(e.target.value as TodoStatusType)
                    }
                    disabled={updateStatusMutation.isPending}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border cursor-pointer focus:outline-none transition-colors ${getStatusBadgeStyle(
                      todo.status
                    )}`}
                    aria-label={`Change status for ${todo.title}`}
                  >
                    {TODO_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s === "IN_PROGRESS"
                          ? "In Progress"
                          : s === "TODO"
                          ? "To Do"
                          : "Done"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Tags Row */}
            {todo.tags && todo.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                {todo.tags.map((tag) => (
                  <TagBadge key={tag.id} tag={tag} size="sm" />
                ))}
              </div>
            )}

            {todo.description && (
              <p
                className={`text-xs whitespace-pre-wrap break-words ${
                  isDone
                    ? "text-neutral-400 dark:text-neutral-500"
                    : "text-neutral-600 dark:text-neutral-400"
                }`}
              >
                {todo.description}
              </p>
            )}

            <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500">
              <Calendar className="h-3 w-3" />
              <span>Created {formattedDate}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAttachments(!showAttachments)}
              className={`h-7 w-7 transition-colors ${
                showAttachments || (todo.attachmentCount && todo.attachmentCount > 0)
                  ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40"
                  : "text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              }`}
              title={showAttachments ? "Hide attachments" : "View attachments"}
              aria-label={`Toggle attachments for: ${todo.title}`}
            >
              <Paperclip className="h-3.5 w-3.5" />
            </Button>

            {!isReadOnly && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditing(true)}
                  className="h-7 w-7 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  title="Edit task"
                  aria-label={`Edit task: ${todo.title}`}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>

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
              </>
            )}
          </div>
        </div>
      )}

      {/* Expanded Attachments Panel in View Mode */}
      {!isEditing && showAttachments && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <TaskAttachmentsPanel
            todoId={todo.id}
            listId={listId}
            isReadOnly={isReadOnly}
          />
        </div>
      )}

      {/* Delete / Status Error Feedbacks */}
      {deleteError && (
        <div className="mt-2 flex items-center justify-between rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            <span>{deleteError}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="h-6 px-1.5 text-xs text-red-700 dark:text-red-300"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {statusError && (
        <div className="mt-2 flex items-center justify-between rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            <span>{statusError}</span>
          </div>
        </div>
      )}
    </div>
  );
}
