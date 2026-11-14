"use client";

import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { ListSidebar } from "@/components/lists/list-sidebar";
import { TodoForm } from "@/components/todos/todo-form";
import { TodoList } from "@/components/todos/todo-list";
import { Badge } from "@/components/ui/badge";
import { ListTodo, CheckCircle2 } from "lucide-react";

export function TodoDashboard() {
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const { data: lists, isLoading } = trpc.todoList.list.useQuery();

  // Automatically select first list when lists are loaded if none selected
  useEffect(() => {
    if (lists && lists.length > 0) {
      if (!selectedListId || !lists.some((l) => l.id === selectedListId)) {
        if (lists[0]) {
          setSelectedListId(lists[0].id);
        }
      }
    } else if (lists && lists.length === 0) {
      setSelectedListId(null);
    }
  }, [lists, selectedListId]);

  const activeList = lists?.find((l) => l.id === selectedListId);

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
              Phase 2
            </Badge>
          </div>
          <span className="text-xs text-neutral-400 font-mono">Personal Lists</span>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Organize your tasks into independent personal lists with lifecycle status tracking.
        </p>
      </header>

      {/* Main Two-Column Layout */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Left: Lists Sidebar */}
        <ListSidebar
          selectedListId={selectedListId}
          onSelectList={(id) => setSelectedListId(id)}
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
              <section aria-label={`Task creation for ${activeList.name}`}>
                <TodoForm listId={activeList.id} listName={activeList.name} />
              </section>

              <section aria-label={`Tasks in ${activeList.name}`}>
                <TodoList listId={activeList.id} />
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
