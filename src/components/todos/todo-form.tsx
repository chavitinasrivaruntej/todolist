"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle, Loader2, Calendar, Flag } from "lucide-react";
import {
  type TodoStatusType,
  type TodoPriorityType,
  TODO_STATUSES,
  TODO_PRIORITIES,
} from "@/lib/validations/todo";
import { type Tag } from "@/db/schema/tags";
import { TagSelector } from "@/components/tags/tag-selector";

interface TodoFormProps {
  listId: string;
  listName: string;
  availableTags?: Array<{ id: string; name: string; color: string; listId?: string }>;
  onManageTags?: () => void;
}

export function TodoForm({ listId, listName, availableTags, onManageTags }: TodoFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TodoStatusType>("TODO");
  const [priority, setPriority] = useState<TodoPriorityType>("MEDIUM");
  const [dueDate, setDueDate] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const createMutation = trpc.todo.create.useMutation({
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      setStatus("TODO");
      setPriority("MEDIUM");
      setDueDate("");
      setSelectedTagIds([]);
      setValidationError(null);
      await Promise.all([
        utils.todo.list.invalidate({ listId }),
        utils.todoList.list.invalidate(),
      ]);
    },
    onError: (err) => {
      setValidationError(err.message || "Failed to create todo.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setValidationError("Please enter a title for the task.");
      return;
    }

    setValidationError(null);
    createMutation.mutate({
      listId,
      title: trimmedTitle,
      description: description.trim() ? description.trim() : undefined,
      status,
      priority,
      dueDate: dueDate ? dueDate : null,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    });
  };

  return (
    <Card className="border-neutral-200/80 shadow-2xs dark:border-neutral-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Add Task to <span className="font-semibold text-neutral-900 dark:text-neutral-50">{listName}</span>
        </CardTitle>
        <CardDescription className="text-xs">
          Create a task with priority, optional due date, tags, and notes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="todo-title" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              id="todo-title"
              placeholder="e.g. Prepare presentation slides"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (validationError) setValidationError(null);
              }}
              disabled={createMutation.isPending}
              maxLength={255}
              className="bg-neutral-50/50 dark:bg-neutral-900/50 text-xs"
            />
          </div>

          <div>
            <label htmlFor="todo-desc" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              Description (optional)
            </label>
            <Textarea
              id="todo-desc"
              placeholder="Add details, links, or notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={createMutation.isPending}
              rows={2}
              maxLength={1000}
              className="bg-neutral-50/50 dark:bg-neutral-900/50 text-xs resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Priority Selector */}
            <div>
              <label htmlFor="todo-priority-select" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                <span className="flex items-center gap-1">
                  <Flag className="h-3 w-3 text-neutral-400" />
                  Priority
                </span>
              </label>
              <select
                id="todo-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TodoPriorityType)}
                disabled={createMutation.isPending}
                className="flex h-9 w-full rounded-md border border-neutral-200 bg-neutral-50/50 px-2 py-1 text-xs shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-950 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-50"
              >
                {TODO_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date Picker */}
            <div>
              <label htmlFor="todo-due-date" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-neutral-400" />
                  Due Date (optional)
                </span>
              </label>
              <Input
                id="todo-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={createMutation.isPending}
                className="bg-neutral-50/50 dark:bg-neutral-900/50 text-xs h-9"
              />
            </div>

            {/* Initial Status */}
            <div>
              <label htmlFor="todo-status-select" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                Initial Status
              </label>
              <select
                id="todo-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as TodoStatusType)}
                disabled={createMutation.isPending}
                className="flex h-9 w-full rounded-md border border-neutral-200 bg-neutral-50/50 px-2 py-1 text-xs shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-950 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-50"
              >
                {TODO_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "IN_PROGRESS" ? "In Progress" : s === "TODO" ? "To Do" : "Done"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags Selector */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              Tags (optional)
            </label>
            <TagSelector
              listId={listId}
              availableTags={availableTags}
              selectedTagIds={selectedTagIds}
              onChange={setSelectedTagIds}
              onManageTags={onManageTags}
            />
          </div>

          {validationError && (
            <div className="rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50">
              {validationError}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              disabled={createMutation.isPending || !title.trim()}
              size="sm"
              className="gap-1.5 text-xs h-8"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Add Task</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
