"use client";

import React, { useState } from "react";
import { type inferRouterOutputs } from "@trpc/server";
import { type AppRouter } from "@/server/api/root";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ListTodo,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertTriangle,
  Loader2,
} from "lucide-react";

type RouterOutput = inferRouterOutputs<AppRouter>;
export type TodoListItemType = RouterOutput["todoList"]["list"][number];

interface ListSidebarProps {
  selectedListId: string | null;
  onSelectList: (id: string) => void;
}

export function ListSidebar({ selectedListId, onSelectList }: ListSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmDeleteList, setConfirmDeleteList] = useState<TodoListItemType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: lists, isLoading } = trpc.todoList.list.useQuery();

  const createMutation = trpc.todoList.create.useMutation({
    onSuccess: async (newList) => {
      setNewListName("");
      setIsCreating(false);
      setErrorMessage(null);
      await utils.todoList.list.invalidate();
      onSelectList(newList.id);
    },
    onError: (err) => {
      setErrorMessage(err.message || "Failed to create list.");
    },
  });

  const renameMutation = trpc.todoList.rename.useMutation({
    onSuccess: async () => {
      setEditingListId(null);
      setEditingName("");
      setErrorMessage(null);
      await utils.todoList.list.invalidate();
    },
    onError: (err) => {
      setErrorMessage(err.message || "Failed to rename list.");
    },
  });

  const deleteMutation = trpc.todoList.delete.useMutation({
    onSuccess: async (_res, variables) => {
      setConfirmDeleteList(null);
      setErrorMessage(null);
      await utils.todoList.list.invalidate();
      if (selectedListId === variables.id && lists && lists.length > 1) {
        const remaining = lists.filter((l) => l.id !== variables.id);
        if (remaining[0]) {
          onSelectList(remaining[0].id);
        }
      }
    },
    onError: (err) => {
      setErrorMessage(err.message || "Failed to delete list.");
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    createMutation.mutate({ name: newListName.trim() });
  };

  const handleRenameSubmit = (id: string) => {
    if (!editingName.trim()) return;
    renameMutation.mutate({ id, name: editingName.trim() });
  };

  const handleDeleteClick = (list: TodoListItemType) => {
    if (list.taskCount > 0) {
      setConfirmDeleteList(list);
    } else {
      deleteMutation.mutate({ id: list.id, force: false });
    }
  };

  return (
    <aside className="w-full md:w-64 flex-shrink-0 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            My Lists
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsCreating(!isCreating);
            setErrorMessage(null);
          }}
          className="h-7 px-2 text-xs gap-1"
          title="Create New List"
          aria-label="Create New List"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New</span>
        </Button>
      </div>

      {errorMessage && (
        <div className="p-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">
          {errorMessage}
        </div>
      )}

      {/* Inline Create List Form */}
      {isCreating && (
        <form onSubmit={handleCreateSubmit} className="space-y-2 p-2 rounded-lg bg-neutral-100/70 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800">
          <Input
            placeholder="e.g. College, Habits..."
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            disabled={createMutation.isPending}
            autoFocus
            className="h-8 text-xs bg-white dark:bg-neutral-950"
            maxLength={100}
          />
          <div className="flex justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsCreating(false)}
              className="h-6 px-2 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createMutation.isPending || !newListName.trim()}
              className="h-6 px-2.5 text-xs"
            >
              {createMutation.isPending ? "Adding..." : "Create"}
            </Button>
          </div>
        </form>
      )}

      {/* Delete Confirmation Modal for Lists with Tasks */}
      {confirmDeleteList && (
        <div className="p-3 text-xs rounded-lg bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300 space-y-2">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Delete &quot;{confirmDeleteList.name}&quot;?</p>
              <p className="text-[11px] mt-0.5 text-red-700 dark:text-red-400">
                This list contains {confirmDeleteList.taskCount} task(s). Deleting it will permanently remove all tasks.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDeleteList(null)}
              className="h-6 px-2 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteMutation.mutate({ id: confirmDeleteList.id, force: true })}
              disabled={deleteMutation.isPending}
              className="h-6 px-2 text-xs"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete All"}
            </Button>
          </div>
        </div>
      )}

      {/* Lists Navigation */}
      <nav className="space-y-1" aria-label="Todo Lists">
        {isLoading ? (
          <div className="space-y-2 pt-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-9 w-full rounded-md bg-neutral-100 dark:bg-neutral-900 animate-pulse"
              />
            ))}
          </div>
        ) : !lists || lists.length === 0 ? (
          <p className="text-xs text-neutral-400 py-2">No lists yet. Create your first list above.</p>
        ) : (
          lists.map((list) => {
            const isSelected = list.id === selectedListId;
            const isEditing = list.id === editingListId;

            if (isEditing) {
              return (
                <div key={list.id} className="flex items-center gap-1 p-1 rounded-md bg-neutral-100 dark:bg-neutral-900">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="h-7 text-xs bg-white dark:bg-neutral-950 flex-1"
                    autoFocus
                    maxLength={100}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRenameSubmit(list.id)}
                    className="h-7 w-7 text-green-600 hover:text-green-700"
                    title="Save"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingListId(null)}
                    className="h-7 w-7 text-neutral-400"
                    title="Cancel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            }

            return (
              <div
                key={list.id}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-950 shadow-sm"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                }`}
                onClick={() => onSelectList(list.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onSelectList(list.id);
                  }
                }}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="truncate">{list.name}</span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Badge
                    variant={isSelected ? "secondary" : "outline"}
                    className="text-[10px] px-1.5 py-0 h-4"
                  >
                    {list.taskCount}
                  </Badge>

                  {/* Actions visible on hover or selection */}
                  <div className={`flex items-center opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? "opacity-100" : ""}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingListId(list.id);
                        setEditingName(list.name);
                      }}
                      className="h-6 w-6 text-inherit hover:text-neutral-400"
                      title="Rename list"
                      aria-label={`Rename list ${list.name}`}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(list);
                      }}
                      disabled={deleteMutation.isPending}
                      className="h-6 w-6 text-inherit hover:text-red-500"
                      title="Delete list"
                      aria-label={`Delete list ${list.name}`}
                    >
                      {deleteMutation.isPending && confirmDeleteList?.id === list.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </nav>
    </aside>
  );
}
