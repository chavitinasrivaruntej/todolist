"use client";

import React from "react";
import { type ViewMode } from "@/hooks/use-list-view-preference";
import { List, Columns3, History } from "lucide-react";

interface ViewSwitcherProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Task view mode switcher"
      className="inline-flex items-center rounded-lg border border-neutral-200 bg-neutral-100/80 p-0.5 dark:border-neutral-800 dark:bg-neutral-900/80"
    >
      <button
        type="button"
        role="button"
        aria-pressed={currentView === "list"}
        onClick={() => onViewChange("list")}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
          currentView === "list"
            ? "bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-neutral-100"
            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        }`}
      >
        <List className="h-3.5 w-3.5" />
        <span>List</span>
      </button>

      <button
        type="button"
        role="button"
        aria-pressed={currentView === "board"}
        onClick={() => onViewChange("board")}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
          currentView === "board"
            ? "bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-neutral-100"
            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        }`}
      >
        <Columns3 className="h-3.5 w-3.5" />
        <span>Board</span>
      </button>

      <button
        type="button"
        role="button"
        aria-pressed={currentView === "activity"}
        onClick={() => onViewChange("activity")}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
          currentView === "activity"
            ? "bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-neutral-100"
            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        }`}
      >
        <History className="h-3.5 w-3.5" />
        <span>Activity</span>
      </button>
    </div>
  );
}
