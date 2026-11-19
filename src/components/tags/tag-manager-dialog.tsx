"use client";

import * as React from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagBadge, TAG_COLOR_STYLES } from "@/components/tags/tag-badge";
import { TAG_COLORS, type TagColor } from "@/db/schema/tags";
import {
  Tag as TagIcon,
  X,
  Plus,
  Loader2,
  AlertCircle,
  Edit2,
  Trash2,
  Check,
} from "lucide-react";

interface TagManagerDialogProps {
  listId: string;
  listName: string;
  isReadOnly?: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TagManagerDialog({
  listId,
  listName,
  isReadOnly = false,
  isOpen,
  onOpenChange,
}: TagManagerDialogProps) {
  const [newTagName, setNewTagName] = React.useState("");
  const [newTagColor, setNewTagColor] = React.useState<TagColor>("slate");
  const [createError, setCreateError] = React.useState<string | null>(null);

  // Edit mode state
  const [editingTagId, setEditingTagId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editColor, setEditColor] = React.useState<TagColor>("slate");
  const [editError, setEditError] = React.useState<string | null>(null);

  const utils = trpc.useUtils();

  const {
    data: tags = [],
    isLoading,
    isError,
    error,
  } = trpc.tag.listByList.useQuery(
    { listId },
    {
      enabled: isOpen,
      refetchOnWindowFocus: false,
    }
  );

  const createMutation = trpc.tag.create.useMutation({
    onSuccess: async () => {
      setNewTagName("");
      setNewTagColor("slate");
      setCreateError(null);
      await Promise.all([
        utils.tag.listByList.invalidate({ listId }),
        utils.todo.list.invalidate({ listId }),
      ]);
    },
    onError: (err) => {
      setCreateError(err.message || "Failed to create tag.");
    },
  });

  const updateMutation = trpc.tag.update.useMutation({
    onSuccess: async () => {
      setEditingTagId(null);
      setEditError(null);
      await Promise.all([
        utils.tag.listByList.invalidate({ listId }),
        utils.todo.list.invalidate({ listId }),
      ]);
    },
    onError: (err) => {
      setEditError(err.message || "Failed to update tag.");
    },
  });

  const deleteMutation = trpc.tag.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.tag.listByList.invalidate({ listId }),
        utils.todo.list.invalidate({ listId }),
      ]);
    },
    onError: (err) => {
      alert(err.message || "Failed to delete tag.");
    },
  });

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onOpenChange]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed) {
      setCreateError("Please enter a tag name.");
      return;
    }
    setCreateError(null);
    createMutation.mutate({
      listId,
      name: trimmed,
      color: newTagColor,
    });
  };

  const handleStartEdit = (tag: { id: string; name: string; color: string }) => {
    setEditingTagId(tag.id);
    setEditName(tag.name);
    setEditColor((tag.color as TagColor) || "slate");
    setEditError(null);
  };

  const handleSaveEdit = (tagId: string) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError("Tag name cannot be empty.");
      return;
    }
    setEditError(null);
    updateMutation.mutate({
      id: tagId,
      name: trimmed,
      color: editColor,
    });
  };

  const handleDelete = (tag: { id: string; name: string }) => {
    if (confirm(`Delete tag "${tag.name}"? It will be removed from all tasks in this list.`)) {
      deleteMutation.mutate({ id: tag.id });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tag-manager-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-neutral-900 shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-800 dark:text-neutral-200">
              <TagIcon className="h-4 w-4" />
            </div>
            <div>
              <h3
                id="tag-manager-title"
                className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
              >
                Manage Tags
              </h3>
              <p className="text-xs text-neutral-500">
                Organize tasks in &ldquo;{listName}&rdquo;
              </p>
            </div>
          </div>

          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Create Tag Form */}
        {!isReadOnly && (
          <form onSubmit={handleCreate} className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="New tag name..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                maxLength={50}
                className="h-8 text-xs bg-white dark:bg-neutral-950 flex-1"
                disabled={createMutation.isPending}
              />
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending || !newTagName.trim()}
                className="h-8 text-xs px-3 gap-1 shrink-0"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add</span>
                  </>
                )}
              </Button>
            </div>

            {/* Color Swatch Picker */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-neutral-500 mr-1">Color:</span>
              {TAG_COLORS.map((c) => {
                const style = TAG_COLOR_STYLES[c];
                const isSelected = newTagColor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className={`h-5 w-5 rounded-full border flex items-center justify-center transition-transform ${style.dot} ${
                      isSelected
                        ? "scale-110 ring-2 ring-offset-1 ring-neutral-400 dark:ring-neutral-500"
                        : "opacity-80 hover:opacity-100 hover:scale-105"
                    }`}
                    title={c}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white drop-shadow-xs" />}
                  </button>
                );
              })}
            </div>

            {createError && (
              <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{createError}</span>
              </p>
            )}
          </form>
        )}

        {/* Existing Tags List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-xs text-neutral-400 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading tags...</span>
            </div>
          ) : isError ? (
            <div className="flex items-center gap-2 text-xs text-red-600 py-4">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error.message || "Failed to load tags"}</span>
            </div>
          ) : tags.length === 0 ? (
            <div className="text-center py-8 text-xs text-neutral-400">
              No tags created yet. Add your first tag above to start organizing tasks!
            </div>
          ) : (
            tags.map((tag) => {
              const isEditing = editingTagId === tag.id;

              if (isEditing) {
                return (
                  <div
                    key={tag.id}
                    className="p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 space-y-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-xs bg-white dark:bg-neutral-900"
                        maxLength={50}
                        disabled={updateMutation.isPending}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(tag.id)}
                        disabled={updateMutation.isPending || !editName.trim()}
                        className="h-7 px-2 text-xs"
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingTagId(null)}
                        disabled={updateMutation.isPending}
                        className="h-7 px-2 text-xs"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Edit Color Swatches */}
                    <div className="flex items-center gap-1.5">
                      {TAG_COLORS.map((c) => {
                        const style = TAG_COLOR_STYLES[c];
                        const isSelected = editColor === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditColor(c)}
                            className={`h-4 w-4 rounded-full border flex items-center justify-center ${style.dot} ${
                              isSelected ? "ring-2 ring-offset-1 ring-neutral-400" : "opacity-80"
                            }`}
                          />
                        );
                      })}
                    </div>

                    {editError && (
                      <p className="text-[11px] text-red-600 dark:text-red-400">{editError}</p>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-800 transition-colors"
                >
                  <TagBadge tag={tag} size="md" />

                  {!isReadOnly && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStartEdit(tag)}
                        className="h-6 w-6 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                        title="Edit tag"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(tag)}
                        disabled={deleteMutation.isPending}
                        className="h-6 w-6 text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                        title="Delete tag"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
