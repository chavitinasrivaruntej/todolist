"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  type TodoPriorityType,
  type DueDateFilterType,
  type SortFieldType,
  type SortDirectionType,
  TODO_PRIORITIES,
} from "@/lib/validations/todo";
import { type Tag } from "@/db/schema/tags";
import { TagBadge } from "@/components/tags/tag-badge";
import { Search, X, SlidersHorizontal, ArrowUpDown, Tag as TagIcon } from "lucide-react";

export interface TaskFilterState {
  search: string;
  priority?: TodoPriorityType;
  dueFilter: DueDateFilterType;
  sortBy: SortFieldType;
  sortDirection: SortDirectionType;
  tagIds?: string[];
  tagOperator?: "AND" | "OR";
}

interface TaskFilterBarProps {
  filters: TaskFilterState;
  onFilterChange: (updated: Partial<TaskFilterState>) => void;
  onReset: () => void;
  taskCount?: number;
  availableTags?: Array<{ id: string; name: string; color: string; listId?: string }>;
}

export function TaskFilterBar({
  filters,
  onFilterChange,
  onReset,
  taskCount,
  availableTags = [],
}: TaskFilterBarProps) {
  const listTags = availableTags;

  const selectedTagIds = filters.tagIds || [];
  const selectedTags = listTags.filter((t) => selectedTagIds.includes(t.id));
  const availableTagsToAdd = listTags.filter((t) => !selectedTagIds.includes(t.id));

  const hasActiveFilters =
    Boolean(filters.search.trim()) ||
    Boolean(filters.priority) ||
    filters.dueFilter !== "ALL" ||
    filters.sortBy !== "created" ||
    filters.sortDirection !== "desc" ||
    selectedTagIds.length > 0;

  const handleAddTagFilter = (tagId: string) => {
    if (!tagId) return;
    const nextTagIds = [...selectedTagIds, tagId];
    onFilterChange({ tagIds: nextTagIds });
  };

  const handleRemoveTagFilter = (tagId: string) => {
    const nextTagIds = selectedTagIds.filter((id) => id !== tagId);
    onFilterChange({ tagIds: nextTagIds.length > 0 ? nextTagIds : undefined });
  };

  const handleToggleTagOperator = () => {
    const nextOp = filters.tagOperator === "OR" ? "AND" : "OR";
    onFilterChange({ tagOperator: nextOp });
  };

  return (
    <div className="space-y-2.5 p-3 rounded-lg border border-neutral-200/80 bg-neutral-50/50 dark:border-neutral-800/80 dark:bg-neutral-900/30">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <Input
            placeholder="Search tasks by title or description..."
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            className="pl-8 pr-7 h-8 text-xs bg-white dark:bg-neutral-950"
            aria-label="Search tasks"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onFilterChange({ search: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <label htmlFor="task-sort-select" className="sr-only">Sort Tasks</label>
          <div className="flex items-center gap-1 text-xs text-neutral-500">
            <ArrowUpDown className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
            <select
              id="task-sort-select"
              value={`${filters.sortBy}-${filters.sortDirection}`}
              onChange={(e) => {
                const [sortBy, sortDirection] = e.target.value.split("-") as [
                  SortFieldType,
                  SortDirectionType
                ];
                onFilterChange({ sortBy, sortDirection });
              }}
              className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs shadow-2xs focus-visible:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
              aria-label="Sort tasks by"
            >
              <option value="created-desc">Newest first</option>
              <option value="created-asc">Oldest first</option>
              <option value="dueDate-asc">Due date: Earliest first</option>
              <option value="dueDate-desc">Due date: Latest first</option>
              <option value="priority-desc">Priority: High to Low</option>
              <option value="priority-asc">Priority: Low to High</option>
              <option value="title-asc">Title: A to Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter Chips: Priority, Due Date & Tags */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-200/60 dark:border-neutral-800/60 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 mr-1 flex items-center gap-1">
            <SlidersHorizontal className="h-3 w-3" />
            Filter:
          </span>

          {/* Priority Filter */}
          <select
            value={filters.priority || "ALL"}
            onChange={(e) =>
              onFilterChange({
                priority:
                  e.target.value === "ALL"
                    ? undefined
                    : (e.target.value as TodoPriorityType),
              })
            }
            className="h-7 rounded border border-neutral-200 bg-white px-2 text-[11px] font-medium shadow-2xs dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
            aria-label="Filter by priority"
          >
            <option value="ALL">All Priorities</option>
            {TODO_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Due Date Filter */}
          <select
            value={filters.dueFilter}
            onChange={(e) =>
              onFilterChange({
                dueFilter: e.target.value as DueDateFilterType,
              })
            }
            className="h-7 rounded border border-neutral-200 bg-white px-2 text-[11px] font-medium shadow-2xs dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
            aria-label="Filter by due date"
          >
            <option value="ALL">All Due Dates</option>
            <option value="OVERDUE">Overdue</option>
            <option value="TODAY">Due Today</option>
            <option value="THIS_WEEK">Due This Week</option>
            <option value="NO_DUE_DATE">No Due Date</option>
          </select>

          {/* Tag Filter Dropdown */}
          {listTags.length > 0 && availableTagsToAdd.length > 0 && (
            <div className="flex items-center gap-1">
              <label htmlFor="task-tag-filter-select" className="sr-only">Filter by tag</label>
              <select
                id="task-tag-filter-select"
                value=""
                onChange={(e) => {
                  if (e.target.value) handleAddTagFilter(e.target.value);
                }}
                className="h-7 rounded border border-neutral-200 bg-white px-2 text-[11px] font-medium shadow-2xs dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                aria-label="Filter by tag"
              >
                <option value="">+ Add Tag Filter...</option>
                {availableTagsToAdd.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-7 px-2 text-[11px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              Reset filters
            </Button>
          )}
        </div>

        {taskCount !== undefined && (
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
            Showing {taskCount} {taskCount === 1 ? "task" : "tasks"}
          </span>
        )}
      </div>

      {/* Selected Tag Filter Chips Row (if any selected) */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-neutral-100 dark:border-neutral-800/40">
          <span className="text-[10px] font-medium text-neutral-400 flex items-center gap-1">
            <TagIcon className="h-2.5 w-2.5" />
            Active Tags:
          </span>
          {selectedTags.map((tag) => (
            <TagBadge
              key={tag.id}
              tag={tag}
              size="sm"
              onRemove={() => handleRemoveTagFilter(tag.id)}
            />
          ))}

          {/* AND / OR toggle operator button if >= 2 tags selected */}
          {selectedTags.length >= 2 && (
            <button
              type="button"
              onClick={handleToggleTagOperator}
              className="ml-1 inline-flex items-center rounded bg-neutral-200/70 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700 dark:text-neutral-300 transition-colors"
              title="Click to toggle between AND (must match all) and OR (match any)"
              aria-label={`Tag filter operator: ${filters.tagOperator || "AND"}`}
            >
              Match: <span className="underline ml-0.5">{filters.tagOperator || "AND"}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
