"use client";

import React from "react";
import { TodoForm } from "@/components/todos/todo-form";
import { TodoList } from "@/components/todos/todo-list";
import { Badge } from "@/components/ui/badge";

export function TodoDashboard() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      {/* Header */}
      <header className="mb-8 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Caize Tasks
            </h1>
            <Badge variant="outline" className="text-[10px] font-normal text-neutral-500">
              Phase 1
            </Badge>
          </div>
          <span className="text-xs text-neutral-400">Minimalist Monolith</span>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Clean architecture demonstration with Next.js App Router, tRPC, Drizzle ORM, and PostgreSQL.
        </p>
      </header>

      {/* Main Body */}
      <main className="space-y-8">
        <section aria-label="Task creation">
          <TodoForm />
        </section>

        <section aria-label="Task listing">
          <TodoList />
        </section>
      </main>
    </div>
  );
}

