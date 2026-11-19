"use client";

import React, { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { TagBadge, getTagStyle } from "@/components/tags/tag-badge";
import { type Tag } from "@/db/schema/tags";
import { Tag as TagIcon, Plus, Check, Settings2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type TagItem = { id: string; name: string; color: string; listId?: string };

interface TagSelectorProps {
  listId: string;
  availableTags?: TagItem[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  isReadOnly?: boolean;
  onManageTags?: () => void;
  className?: string;
}

export function TagSelector({
  listId,
  availableTags,
  selectedTagIds,
  onChange,
  isReadOnly = false,
  onManageTags,
  className = "",
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const queryResult = trpc.tag.listByList.useQuery(
    { listId },
    { enabled: availableTags === undefined && Boolean(listId) }
  );

  const tags = availableTags !== undefined ? availableTags : (queryResult.data || []);
  const isLoading = availableTags !== undefined ? false : queryResult.isLoading;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id));

  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const handleRemoveTag = (tagId: string) => {
    onChange(selectedTagIds.filter((id) => id !== tagId));
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Selected tags chip display */}
      <div className="flex flex-wrap items-center gap-1.5 min-h-[22px]">
        {selectedTags.map((tag) => (
          <TagBadge
            key={tag.id}
            tag={tag}
            size="sm"
            onRemove={!isReadOnly ? () => handleRemoveTag(tag.id) : undefined}
          />
        ))}

        {!isReadOnly && (
          <div className="relative inline-block" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center gap-1 rounded border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/50 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"
              aria-label="Assign tags"
              aria-expanded={isOpen}
            >
              <TagIcon className="h-3 w-3" />
              <span>{selectedTags.length === 0 ? "Add tags" : "Edit tags"}</span>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-neutral-200 bg-white p-1.5 shadow-lg dark:border-neutral-800 dark:bg-neutral-950 text-xs">
                <div className="flex items-center justify-between px-2 py-1 border-b border-neutral-100 dark:border-neutral-800 mb-1">
                  <span className="font-semibold text-[11px] text-neutral-700 dark:text-neutral-300">
                    Select Tags
                  </span>
                  {onManageTags && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onManageTags();
                      }}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                    >
                      <Settings2 className="h-2.5 w-2.5" />
                      Manage
                    </button>
                  )}
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center p-3 text-neutral-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : tags.length === 0 ? (
                  <div className="p-3 text-center">
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mb-2">
                      No tags created yet.
                    </p>
                    {onManageTags && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsOpen(false);
                          onManageTags();
                        }}
                        className="h-6 text-[10px] w-full"
                      >
                        <Plus className="h-2.5 w-2.5 mr-1" />
                        Create Tag
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-0.5 py-0.5">
                    {tags.map((tag) => {
                      const isSelected = selectedTagIds.includes(tag.id);
                      const style = getTagStyle(tag.color);

                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleToggleTag(tag.id)}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900 ${
                            isSelected ? "bg-neutral-100/70 dark:bg-neutral-900/70" : ""
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${style.dot}`} />
                            <span className="truncate text-xs text-neutral-800 dark:text-neutral-200">
                              {tag.name}
                            </span>
                          </div>
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
