"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { ListSidebar } from "@/components/lists/list-sidebar";
import { TodoForm } from "@/components/todos/todo-form";
import { TodoList } from "@/components/todos/todo-list";
import { KanbanBoard } from "@/components/todos/kanban/kanban-board";
import { ActivityTimeline } from "@/components/todos/activity/activity-timeline";
import { ViewSwitcher } from "@/components/todos/view-switcher";
import { TaskFilterBar, type TaskFilterState } from "@/components/todos/task-filter-bar";
import { TagManagerDialog } from "@/components/tags/tag-manager-dialog";
import { useListViewPreference } from "@/hooks/use-list-view-preference";
import { UserMenu } from "@/components/auth/user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ShareListDialog } from "@/components/sharing/share-list-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ListTodo,
  CheckCircle2,
  Shield,
  Eye,
  Crown,
  Loader2,
  Tag as TagIcon,
} from "lucide-react";

const initialFilters: TaskFilterState = {
  search: "",
  priority: undefined,
  dueFilter: "ALL",
  sortBy: "created",
  sortDirection: "desc",
  tagIds: undefined,
  tagOperator: "AND",
};

function TodoDashboardInner() {
  const searchParams = useSearchParams();
  const urlListId = searchParams.get("listId");
  const [selectedListId, setSelectedListId] = useState<string | null>(urlListId);
  const [filters, setFilters] = useState<TaskFilterState>(initialFilters);
  const [filteredCount, setFilteredCount] = useState<number | undefined>(undefined);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);

  const { data: lists, isLoading } = trpc.todoList.list.useQuery();
  const { data: listTags = [] } = trpc.tag.listByList.useQuery(
    { listId: selectedListId! },
    { enabled: Boolean(selectedListId) }
  );
  const { viewMode, setViewMode } = useListViewPreference(selectedListId);

  // Automatically select first list or urlListId when lists are loaded
  useEffect(() => {
    if (lists && lists.length > 0) {
      if (urlListId && lists.some((l) => l.id === urlListId)) {
        setSelectedListId(urlListId);
      } else if (!selectedListId || !lists.some((l) => l.id === selectedListId)) {
        if (lists[0]) {
          setSelectedListId(lists[0].id);
        }
      }
    } else if (lists && lists.length === 0) {
      setSelectedListId(null);
    }
  }, [lists, selectedListId, urlListId]);

  // Reset filters when active list changes
  const handleSelectList = (id: string) => {
    setSelectedListId(id);
    setFilters(initialFilters);
  };

  const handleFilterChange = (updated: Partial<TaskFilterState>) => {
    setFilters((prev) => ({ ...prev, ...updated }));
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
  };

  const activeList = lists?.find((l) => l.id === selectedListId);
  const effectiveRole = activeList?.effectiveRole ?? "OWNER";
  const isOwner = effectiveRole === "OWNER";
  const isReadOnly = effectiveRole === "VIEWER";
  const isEditor = effectiveRole === "EDITOR";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <header className="mb-6 space-y-1.5 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-neutral-50 dark:bg-neutral-50 dark:text-neutral-900">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Caize Tasks
            </h1>
            <Badge variant="outline" className="text-[10px] font-normal text-neutral-500">
              Phase 8: Color-Coded Tags & Labels
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell onSelectList={(id) => handleSelectList(id)} />
            <UserMenu />
          </div>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Priorities, calendar due dates, color-coded tags & labels, multi-tag filtering, deterministic sorting, and activity history.
        </p>
      </header>

      {/* Main Two-Column Layout */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Left: Lists Sidebar */}
        <ListSidebar
          selectedListId={selectedListId}
          onSelectList={handleSelectList}
        />

        {/* Right: Tasks Area */}
        <main className="flex-1 w-full space-y-6">
          {isLoading ? (
            <div className="space-y-4 pt-2">
              <div className="h-28 w-full rounded-xl bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
              <div className="h-48 w-full rounded-xl bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
            </div>
          ) : activeList ? (
            <>
              {/* Active List Heading & View Switcher */}
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200/60 dark:border-neutral-800/60 gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {activeList.name}
                  </h2>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                    {activeList.taskCount} {activeList.taskCount === 1 ? "task" : "tasks"}
                  </Badge>

                  {/* Role Badge */}
                  {isOwner ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-800 shrink-0 gap-1"
                    >
                      <Crown className="h-2.5 w-2.5" />
                      Owner
                    </Badge>
                  ) : isEditor ? (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0 gap-1">
                      <Shield className="h-2.5 w-2.5" />
                      Editor
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 gap-1">
                      <Eye className="h-2.5 w-2.5" />
                      Viewer
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {/* Tags Manager Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsTagManagerOpen(true)}
                    className="h-8 gap-1.5 text-xs border-neutral-300 dark:border-neutral-700"
                    title="Manage list tags and labels"
                    aria-label="Manage tags"
                  >
                    <TagIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Tags</span>
                  </Button>

                  {/* Share button only available for OWNER */}
                  {isOwner && (
                    <ShareListDialog
                      listId={activeList.id}
                      listName={activeList.name}
                    />
                  )}

                  <ViewSwitcher currentView={viewMode} onViewChange={setViewMode} />
                </div>
              </div>

              {/* Tag Manager Dialog */}
              <TagManagerDialog
                listId={activeList.id}
                listName={activeList.name}
                isReadOnly={isReadOnly}
                isOpen={isTagManagerOpen}
                onOpenChange={setIsTagManagerOpen}
              />

              {/* Role Context Banners */}
              {isReadOnly && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 text-xs border border-neutral-200 dark:border-neutral-800">
                  <Eye className="h-4 w-4 shrink-0 text-neutral-500 mt-0.5" />
                  <div>
                    <span className="font-semibold">Read-Only View:</span> You have view-only access to this shared list. Only the list owner and editors can add, edit, move, or delete tasks.
                  </div>
                </div>
              )}

              {isEditor && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 text-xs border border-blue-200 dark:border-blue-900">
                  <Shield className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>
                    <strong>Editor Access:</strong> You can add, edit, move, and complete tasks in this shared list.
                  </span>
                </div>
              )}

              {/* Task Creation Form (Hidden for Viewers and when in Activity view) */}
              {!isReadOnly && viewMode !== "activity" && (
                <section aria-label={`Task creation for ${activeList.name}`}>
                  <TodoForm
                    listId={activeList.id}
                    listName={activeList.name}
                    availableTags={listTags}
                    onManageTags={() => setIsTagManagerOpen(true)}
                  />
                </section>
              )}

              {/* Filter & Search Bar (Visible in List and Board views) */}
              {viewMode !== "activity" && (
                <section aria-label="Task search and filters">
                  <TaskFilterBar
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    onReset={handleResetFilters}
                    taskCount={filteredCount}
                    availableTags={listTags}
                  />
                </section>
              )}

              {/* View Content (List View vs Kanban Board View vs Activity Timeline) */}
              <section aria-label={`Tasks in ${activeList.name} (${viewMode} view)`}>
                {viewMode === "list" ? (
                  <TodoList
                    listId={activeList.id}
                    isReadOnly={isReadOnly}
                    filters={filters}
                    onTaskCountChange={setFilteredCount}
                  />
                ) : viewMode === "board" ? (
                  <KanbanBoard
                    listId={activeList.id}
                    isReadOnly={isReadOnly}
                    filters={filters}
                    onTaskCountChange={setFilteredCount}
                  />
                ) : (
                  <ActivityTimeline listId={activeList.id} />
                )}
              </section>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 p-12 text-center dark:border-neutral-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 mb-3 text-neutral-400">
                <ListTodo className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                No active list selected
              </h3>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Create a new list on the left to start organizing your tasks.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export function TodoDashboard() {
  return (
    <React.Suspense
      fallback={
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      }
    >
      <TodoDashboardInner />
    </React.Suspense>
  );
}
