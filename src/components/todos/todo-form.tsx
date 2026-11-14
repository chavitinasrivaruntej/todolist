"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle, Loader2 } from "lucide-react";

export function TodoForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const createMutation = trpc.todo.create.useMutation({
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      setValidationError(null);
      await utils.todo.list.invalidate();
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
      title: trimmedTitle,
      description: description.trim() ? description.trim() : undefined,
    });
  };

  return (
    <Card className="border-neutral-200/80 shadow-sm dark:border-neutral-800">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-medium">Create New Task</CardTitle>
        <CardDescription>
          Add a task with an optional description to keep track of your work.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="todo-title" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              id="todo-title"
              placeholder="e.g. Implement authentication module"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (validationError) setValidationError(null);
              }}
              disabled={createMutation.isPending}
              maxLength={255}
              className="bg-neutral-50/50 dark:bg-neutral-900/50"
            />
          </div>

          <div>
            <label htmlFor="todo-desc" className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              Description (optional)
            </label>
            <Textarea
              id="todo-desc"
              placeholder="Additional context, links, or acceptance criteria..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={createMutation.isPending}
              rows={2}
              maxLength={1000}
              className="bg-neutral-50/50 dark:bg-neutral-900/50 resize-y"
            />
          </div>

          {validationError && (
            <div className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50">
              {validationError}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              disabled={createMutation.isPending || !title.trim()}
              size="sm"
              className="gap-1.5"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Add Todo</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
