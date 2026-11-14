"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { type TodoStatusType } from "@/lib/validations/todo";
import { KanbanCard, type TodoListItem } from "@/components/todos/kanban/kanban-card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, CircleDot, Inbox } from "lucide-react";

interface KanbanColumnProps {
  status: TodoStatusType;
  title: string;
  todos: TodoListItem[];
  listId: string;
}

export function KanbanColumn({ status, title, todos, listId }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { status },
  });

  const getStatusIcon = (status: TodoStatusType) => {
    switch (status) {
      case "TODO":
        return <CircleDot className="h-3.5 w-3.5 text-neutral-500" />;
      case "IN_PROGRESS":
        return <Clock className="h-3.5 w-3.5 text-blue-500" />;
      case "DONE":
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    }
  };

  const getHeaderBadgeVariant = (status: TodoStatusType) => {
    switch (status) {
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900";
      case "DONE":
        return "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300 border-green-200 dark:border-green-900";
      case "TODO":
      default:
        return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700";
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border p-3 min-h-[360px] transition-all duration-200 ${
        isOver
          ? "border-neutral-400 bg-neutral-100/90 dark:border-neutral-600 dark:bg-neutral-800/50 ring-2 ring-neutral-400/40 dark:ring-neutral-600/40"
          : "border-neutral-200/80 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900/30"
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex items-center gap-2">
          {getStatusIcon(status)}
          <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
          </h3>
        </div>

        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 h-4 font-mono ${getHeaderBadgeVariant(status)}`}
        >
          {todos.length}
        </Badge>
      </div>

      {/* Column Body / Tasks Stack */}
      <div className="flex-1 space-y-2.5 overflow-y-auto min-h-[100px]">
        {todos.length === 0 ? (
          <div
            className={`flex flex-col items-center justify-center h-48 rounded-lg border border-dashed p-4 text-center transition-colors ${
              isOver
                ? "border-neutral-400/80 bg-neutral-200/40 dark:border-neutral-600/80 dark:bg-neutral-800/40"
                : "border-neutral-200/70 dark:border-neutral-800/70"
            }`}
          >
            <Inbox className="h-5 w-5 text-neutral-300 dark:text-neutral-600 mb-1" />
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
              {isOver ? `Drop to move to ${title}` : `No tasks ${title.toLowerCase()}`}
            </p>
          </div>
        ) : (
          todos.map((todo) => (
            <KanbanCard key={todo.id} todo={todo} listId={listId} />
          ))
        )}
      </div>
    </div>
  );
}
