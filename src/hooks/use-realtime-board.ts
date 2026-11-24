"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  type RealtimeEventEnvelope,
  type CollaboratorPresenceState,
  type TaskCreatedPayload,
  type TaskUpdatedPayload,
  type TaskStatusChangedPayload,
  type TaskDeletedPayload,
  type TaskAttachmentUpdatedPayload,
  type CollaboratorChangedPayload,
} from "@/lib/realtime/realtime-events";
import {
  subscribeToListChannel,
  type RealtimeConnectionStatus,
} from "@/lib/realtime/realtime-client";
import type { TaskFilterState } from "@/components/todos/task-filter-bar";
import { type inferRouterOutputs } from "@trpc/server";
import { type AppRouter } from "@/server/api/root";

type RouterOutput = inferRouterOutputs<AppRouter>;
export type TodoListItem = RouterOutput["todo"]["list"][number];

interface RawTodoItemInput {
  id: string;
  listId: string;
  title: string;
  description?: string | null;
  status: TodoListItem["status"];
  priority: TodoListItem["priority"];
  dueDate?: string | null;
  recurrenceRuleId?: string | null;
  occurrenceNumber?: number | null;
  version?: number;
  attachmentCount?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  tags?: Array<{
    id: string;
    listId: string;
    name: string;
    color: string;
    createdAt?: string | Date;
    updatedAt?: string | Date;
  }>;
}

function toClientTodoItem(t: RawTodoItemInput): TodoListItem {
  return {
    id: t.id,
    listId: t.listId,
    title: t.title,
    description: t.description ?? null,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate ?? null,
    recurrenceRuleId: t.recurrenceRuleId ?? null,
    occurrenceNumber: t.occurrenceNumber ?? null,
    version: t.version ?? 1,
    attachmentCount: t.attachmentCount ?? 0,
    createdAt:
      typeof t.createdAt === "string"
        ? t.createdAt
        : t.createdAt
        ? new Date(t.createdAt).toISOString()
        : new Date().toISOString(),
    updatedAt:
      typeof t.updatedAt === "string"
        ? t.updatedAt
        : t.updatedAt
        ? new Date(t.updatedAt).toISOString()
        : new Date().toISOString(),
    tags: (t.tags || []).map((tag) => ({
      id: tag.id,
      listId: tag.listId,
      name: tag.name,
      color: tag.color,
      createdAt:
        typeof tag.createdAt === "string"
          ? tag.createdAt
          : tag.createdAt
          ? new Date(tag.createdAt).toISOString()
          : new Date().toISOString(),
      updatedAt:
        typeof tag.updatedAt === "string"
          ? tag.updatedAt
          : tag.updatedAt
          ? new Date(tag.updatedAt).toISOString()
          : new Date().toISOString(),
    })),
  };
}

interface UseRealtimeBoardOptions {
  listId: string | null;
  filters?: TaskFilterState;
  currentUser?: {
    id: string;
    displayName?: string;
    avatarUrl?: string;
  } | null;
  effectiveRole?: "OWNER" | "EDITOR" | "VIEWER";
  activeView?: "list" | "board" | "activity";
}

export interface UniqueCollaborator {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  activeView: "list" | "board" | "activity";
  editingTodoId?: string | null;
  sessionCount: number;
}

// Bounded LRU event ID cache to prevent duplicate deliveries
const MAX_SEEN_EVENTS = 100;

export function useRealtimeBoard({
  listId,
  filters,
  currentUser,
  effectiveRole = "OWNER",
  activeView = "list",
}: UseRealtimeBoardOptions) {
  const [status, setStatus] = useState<RealtimeConnectionStatus>("IDLE");
  const [rawPresences, setRawPresences] = useState<CollaboratorPresenceState[]>([]);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const subscriptionRef = useRef<ReturnType<typeof subscribeToListChannel> | null>(null);

  // Generate or retrieve persistent-per-tab session ID
  const [tabSessionId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const globalKey = "__CAIZE_REALTIME_TAB_ID__";
      const existing = (window as unknown as Record<string, string>)[globalKey];
      if (existing) return existing;
      const created = crypto.randomUUID();
      (window as unknown as Record<string, string>)[globalKey] = created;
      return created;
    }
    return "server-session";
  });

  const utils = trpc.useUtils();

  // Pre-flight authorization check
  const { data: authData, isError: isAuthError } = trpc.realtime.authorizeChannel.useQuery(
    { listId: listId! },
    {
      enabled: Boolean(listId),
      retry: false,
    }
  );

  // Helper to test if a task satisfies active filters
  const matchesActiveFilters = useCallback(
    (task: { title: string; description?: string | null; priority?: string; tags?: Array<{ id: string }> }): boolean => {
      if (!filters) return true;

      // 1. Text Search Filter
      if (filters.search && filters.search.trim().length > 0) {
        const query = filters.search.trim().toLowerCase();
        const titleMatch = task.title.toLowerCase().includes(query);
        const descMatch = (task.description || "").toLowerCase().includes(query);
        if (!titleMatch && !descMatch) return false;
      }

      // 2. Priority Filter
      if (filters.priority && task.priority !== filters.priority) {
        return false;
      }

      // 3. Tag Filters
      if (filters.tagIds && filters.tagIds.length > 0) {
        const taskTagIds = new Set((task.tags || []).map((t) => t.id));
        if (filters.tagOperator === "OR") {
          const hasAny = filters.tagIds.some((id) => taskTagIds.has(id));
          if (!hasAny) return false;
        } else {
          // AND operator
          const hasAll = filters.tagIds.every((id) => taskTagIds.has(id));
          if (!hasAll) return false;
        }
      }

      return true;
    },
    [filters]
  );

  // Dispatch incoming realtime domain events into TanStack Query cache
  const handleRealtimeEvent = useCallback(
    (envelope: RealtimeEventEnvelope) => {
      if (!listId || envelope.listId !== listId) return;

      // 1. Deduplicate by eventId
      if (seenEventIdsRef.current.has(envelope.eventId)) {
        return;
      }
      seenEventIdsRef.current.add(envelope.eventId);
      if (seenEventIdsRef.current.size > MAX_SEEN_EVENTS) {
        const first = seenEventIdsRef.current.values().next().value;
        if (first) seenEventIdsRef.current.delete(first);
      }

      const isOriginatingTab =
        Boolean(envelope.clientSessionId) &&
        envelope.clientSessionId === tabSessionId;

      switch (envelope.eventType) {
        case "TASK_CREATED": {
          const payload = envelope.payload as TaskCreatedPayload;
          if (isOriginatingTab) return; // Originating tab already added task via mutation

          // Check if newly created task matches current filter criteria
          if (!matchesActiveFilters(payload)) {
            // Task belongs to list, but not to current filtered view; update list counts only
            utils.todoList.list.invalidate();
            return;
          }

          const clientItem = toClientTodoItem(payload);

          // Direct cache insertion
          utils.todo.list.setData(
            { listId, ...filters },
            (existing: TodoListItem[] | undefined) => {
              if (!existing) return [clientItem];
              if (existing.some((t) => t.id === clientItem.id)) return existing;
              return [clientItem, ...existing];
            }
          );
          utils.todoList.list.invalidate();
          break;
        }

        case "TASK_STATUS_CHANGED": {
          const payload = envelope.payload as TaskStatusChangedPayload;
          utils.todo.list.setData(
            { listId, ...filters },
            (existing: TodoListItem[] | undefined) => {
              if (!existing) return existing;
              return existing.map((t) => {
                if (t.id !== payload.id) return t;

                // Monotonic version check: drop stale events
                if (t.version !== undefined && payload.version <= t.version) {
                  return t;
                }

                return {
                  ...t,
                  status: payload.status,
                  version: payload.version,
                  updatedAt: payload.updatedAt,
                };
              });
            }
          );
          utils.todoList.list.invalidate();
          break;
        }

        case "TASK_UPDATED": {
          const payload = envelope.payload as TaskUpdatedPayload;
          utils.todo.list.setData(
            { listId, ...filters },
            (existing: TodoListItem[] | undefined) => {
              if (!existing) return existing;
              return existing.map((t) => {
                if (t.id !== payload.id) return t;

                // Monotonic version check
                if (t.version !== undefined && payload.version <= t.version) {
                  return t;
                }

                return toClientTodoItem({
                  ...t,
                  ...payload,
                  attachmentCount: payload.attachmentCount ?? t.attachmentCount,
                });
              });
            }
          );
          break;
        }

        case "TASK_ATTACHMENT_UPDATED": {
          const payload = envelope.payload as TaskAttachmentUpdatedPayload;
          utils.todo.list.setData(
            { listId, ...filters },
            (existing: TodoListItem[] | undefined) => {
              if (!existing) return existing;
              return existing.map((t) => {
                if (t.id !== payload.todoId) return t;

                // Monotonic version check
                if (t.version !== undefined && payload.version <= t.version) {
                  return t;
                }

                return {
                  ...t,
                  attachmentCount: payload.attachmentCount,
                  version: payload.version,
                };
              });
            }
          );
          break;
        }

        case "TASK_DELETED": {
          const payload = envelope.payload as TaskDeletedPayload;
          utils.todo.list.setData(
            { listId, ...filters },
            (existing: TodoListItem[] | undefined) => {
              if (!existing) return existing;
              return existing.filter((t) => {
                if (t.id !== payload.id) return true;

                // Monotonic version check: drop stale deletion if client already has a newer version
                if (
                  envelope.version !== undefined &&
                  t.version !== undefined &&
                  envelope.version < t.version
                ) {
                  return true;
                }

                return false;
              });
            }
          );
          utils.todoList.list.invalidate();
          break;
        }

        case "RECURRENCE_CHANGED": {
          utils.todoList.list.invalidate();
          utils.todo.list.invalidate({ listId });
          break;
        }

        case "LIST_UPDATED": {
          // Authoritative list refresh
          utils.todoList.list.invalidate();
          break;
        }

        case "LIST_DELETED": {
          // Clean up local cache and indicate unavailable
          subscriptionRef.current?.unsubscribe();
          subscriptionRef.current = null;
          setStatus("UNAVAILABLE");
          setRawPresences([]);
          utils.todo.list.setData({ listId, ...filters }, () => []);
          utils.todoList.list.invalidate();
          break;
        }

        case "COLLABORATOR_CHANGED": {
          const payload = envelope.payload as CollaboratorChangedPayload;
          // If current user had their membership revoked, immediately tear down subscription and clear protected data
          if (
            payload.action === "REMOVED" &&
            currentUser &&
            payload.targetUserId === currentUser.id
          ) {
            subscriptionRef.current?.unsubscribe();
            subscriptionRef.current = null;
            setStatus("UNAVAILABLE");
            setRawPresences([]);
            utils.todo.list.setData({ listId, ...filters }, () => []);
            utils.todoList.list.invalidate();
          } else {
            utils.sharing.getMembersAndInvites.invalidate({ listId });
          }
          break;
        }

        default:
          break;
      }
    },
    [listId, filters, tabSessionId, matchesActiveFilters, currentUser, utils]
  );

  // Group multiple raw presences by unique userId
  const uniqueCollaborators = useMemo<UniqueCollaborator[]>(() => {
    const userMap = new Map<string, UniqueCollaborator>();

    for (const p of rawPresences) {
      if (!p.userId) continue;

      const existing = userMap.get(p.userId);
      if (existing) {
        existing.sessionCount += 1;
        // Keep most active view/editing state
        if (p.editingTodoId) existing.editingTodoId = p.editingTodoId;
      } else {
        userMap.set(p.userId, {
          userId: p.userId,
          displayName: p.displayName || "Collaborator",
          avatarUrl: p.avatarUrl,
          role: p.role,
          activeView: p.activeView,
          editingTodoId: p.editingTodoId,
          sessionCount: 1,
        });
      }
    }

    return Array.from(userMap.values());
  }, [rawPresences]);

  // Establish private channel lifecycle
  useEffect(() => {
    if (!listId || !authData?.authorized || isAuthError) {
      setStatus(isAuthError ? "UNAVAILABLE" : "IDLE");
      setRawPresences([]);
      return;
    }

    const initialPresence: CollaboratorPresenceState | undefined = currentUser
      ? {
          userId: currentUser.id,
          sessionId: tabSessionId,
          displayName: currentUser.displayName || "Collaborator",
          avatarUrl: currentUser.avatarUrl,
          role: effectiveRole,
          activeView,
          onlineAt: new Date().toISOString(),
        }
      : undefined;

    const subscription = subscribeToListChannel({
      listId,
      initialPresence,
      onEvent: handleRealtimeEvent,
      onPresenceSync: (presences) => {
        setRawPresences(presences);
      },
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
    });
    subscriptionRef.current = subscription;

    // Reconnection and tab-resumption listener: Authoritative resync
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        utils.todo.list.invalidate({ listId });
        utils.todoList.list.invalidate();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      subscription.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [
    listId,
    authData?.authorized,
    isAuthError,
    currentUser,
    tabSessionId,
    effectiveRole,
    activeView,
    handleRealtimeEvent,
    utils,
  ]);

  return {
    status,
    collaborators: uniqueCollaborators,
    tabSessionId,
  };
}
