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

export interface RealtimeActivityNotification {
  id: string;
  message: string;
  type:
    | "TASK_CREATED"
    | "TASK_UPDATED"
    | "TASK_STATUS_CHANGED"
    | "TASK_DELETED"
    | "COLLABORATOR_JOINED"
    | "COLLABORATOR_LEFT";
  actorName?: string;
  timestamp: number;
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
  editingTodoId?: string | null;
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
// Bounded LRU cache of recently deleted task IDs to prevent late resurrection
const MAX_DELETED_TASK_HISTORY = 200;

export function useRealtimeBoard({
  listId,
  filters,
  currentUser,
  effectiveRole = "OWNER",
  activeView = "list",
  editingTodoId = null,
}: UseRealtimeBoardOptions) {
  const [status, setStatus] = useState<RealtimeConnectionStatus>("IDLE");
  const [rawPresences, setRawPresences] = useState<CollaboratorPresenceState[]>([]);
  const [recentActivity, setRecentActivity] = useState<RealtimeActivityNotification | null>(null);

  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const deletedTaskIdsRef = useRef<Set<string>>(new Set());
  const subscriptionRef = useRef<ReturnType<typeof subscribeToListChannel> | null>(null);
  const currentListIdRef = useRef<string | null>(listId);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVisibilityRef = useRef<number>(0);

  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const effectiveRoleRef = useRef(effectiveRole);
  useEffect(() => {
    effectiveRoleRef.current = effectiveRole;
  }, [effectiveRole]);

  const activeViewRef = useRef(activeView);
  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  const editingTodoIdRef = useRef(editingTodoId);
  useEffect(() => {
    editingTodoIdRef.current = editingTodoId;
  }, [editingTodoId]);

  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Track active listId in ref for stale callback prevention
  useEffect(() => {
    currentListIdRef.current = listId;
  }, [listId]);

  // Clean up activity timer on unmount
  useEffect(() => {
    return () => {
      if (activityTimerRef.current) {
        clearTimeout(activityTimerRef.current);
      }
    };
  }, []);

  const triggerActivity = useCallback(
    (activity: Omit<RealtimeActivityNotification, "id" | "timestamp">) => {
      if (activityTimerRef.current) {
        clearTimeout(activityTimerRef.current);
      }
      const item: RealtimeActivityNotification = {
        ...activity,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };
      setRecentActivity(item);
      activityTimerRef.current = setTimeout(() => {
        setRecentActivity(null);
      }, 4000);
    },
    []
  );

  const dismissActivity = useCallback(() => {
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
    }
    setRecentActivity(null);
  }, []);

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
  const utilsRef = useRef(utils);
  useEffect(() => {
    utilsRef.current = utils;
  }, [utils]);

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
      const activeFilters = filtersRef.current;
      if (!activeFilters) return true;

      // 1. Text Search Filter
      if (activeFilters.search && activeFilters.search.trim().length > 0) {
        const query = activeFilters.search.trim().toLowerCase();
        const titleMatch = task.title.toLowerCase().includes(query);
        const descMatch = (task.description || "").toLowerCase().includes(query);
        if (!titleMatch && !descMatch) return false;
      }

      // 2. Priority Filter
      if (activeFilters.priority && task.priority !== activeFilters.priority) {
        return false;
      }

      // 3. Tag Filters
      if (activeFilters.tagIds && activeFilters.tagIds.length > 0) {
        const taskTagIds = new Set((task.tags || []).map((t) => t.id));
        if (activeFilters.tagOperator === "OR") {
          const hasAny = activeFilters.tagIds.some((id) => taskTagIds.has(id));
          if (!hasAny) return false;
        } else {
          // AND operator
          const hasAll = activeFilters.tagIds.every((id) => taskTagIds.has(id));
          if (!hasAll) return false;
        }
      }

      return true;
    },
    []
  );

  // Dispatch incoming realtime domain events into TanStack Query cache
  const handleRealtimeEvent = useCallback(
    (envelope: RealtimeEventEnvelope) => {
      const activeListId = currentListIdRef.current;
      const activeFilters = filtersRef.current;

      // Guard against events belonging to a different or previously viewed list
      if (!activeListId || envelope.listId !== activeListId) return;

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

      const currentUserId = currentUserRef.current?.id;
      const isOtherUser =
        !isOriginatingTab &&
        Boolean(envelope.actorId) &&
        envelope.actorId !== currentUserId;

      switch (envelope.eventType) {
        case "TASK_CREATED": {
          const payload = envelope.payload as TaskCreatedPayload;
          if (isOriginatingTab) return; // Originating tab already added task via mutation

          // Prevent resurrecting a task that was already deleted locally or remotely
          if (deletedTaskIdsRef.current.has(payload.id)) {
            return;
          }

          if (isOtherUser) {
            triggerActivity({
              type: "TASK_CREATED",
              message: `Task "${payload.title}" created`,
            });
          }

          // Check if newly created task matches current filter criteria
          if (!matchesActiveFilters(payload)) {
            // Task belongs to list, but not to current filtered view; update list counts only
            utilsRef.current.todoList.list.invalidate();
            return;
          }

          // If view has complex dueFilter or search, invalidate query for authoritative server sort/filter
          if (activeFilters?.dueFilter && activeFilters.dueFilter !== "ALL") {
            utilsRef.current.todo.list.invalidate({ listId: activeListId });
            utilsRef.current.todoList.list.invalidate();
            return;
          }

          const clientItem = toClientTodoItem(payload);

          // Direct cache insertion
          utilsRef.current.todo.list.setData(
            { listId: activeListId, ...activeFilters },
            (existing: TodoListItem[] | undefined) => {
              if (!existing) return [clientItem];
              if (existing.some((t) => t.id === clientItem.id)) return existing;
              return [clientItem, ...existing];
            }
          );
          utilsRef.current.todoList.list.invalidate();
          break;
        }

        case "TASK_STATUS_CHANGED": {
          const payload = envelope.payload as TaskStatusChangedPayload;

          // Prevent resurrecting or modifying a deleted task
          if (deletedTaskIdsRef.current.has(payload.id)) {
            return;
          }

          if (isOtherUser) {
            triggerActivity({
              type: "TASK_STATUS_CHANGED",
              message: `Task status changed to ${payload.status.replace("_", " ")}`,
            });
          }

          utilsRef.current.todo.list.setData(
            { listId: activeListId, ...activeFilters },
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
          utilsRef.current.todoList.list.invalidate();
          break;
        }

        case "TASK_UPDATED": {
          const payload = envelope.payload as TaskUpdatedPayload;

          // Prevent resurrecting or modifying a deleted task
          if (deletedTaskIdsRef.current.has(payload.id)) {
            return;
          }

          if (isOtherUser) {
            triggerActivity({
              type: "TASK_UPDATED",
              message: `Task "${payload.title}" updated`,
            });
          }

          utilsRef.current.todo.list.setData(
            { listId: activeListId, ...activeFilters },
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

          if (deletedTaskIdsRef.current.has(payload.todoId)) {
            return;
          }

          utilsRef.current.todo.list.setData(
            { listId: activeListId, ...activeFilters },
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

          // Record in deleted history to prevent late resurrection
          deletedTaskIdsRef.current.add(payload.id);
          if (deletedTaskIdsRef.current.size > MAX_DELETED_TASK_HISTORY) {
            const first = deletedTaskIdsRef.current.values().next().value;
            if (first) deletedTaskIdsRef.current.delete(first);
          }

          if (isOtherUser) {
            triggerActivity({
              type: "TASK_DELETED",
              message: "A task was deleted",
            });
          }

          utilsRef.current.todo.list.setData(
            { listId: activeListId, ...activeFilters },
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
          utilsRef.current.todoList.list.invalidate();
          break;
        }

        case "RECURRENCE_CHANGED": {
          utilsRef.current.todoList.list.invalidate();
          utilsRef.current.todo.list.invalidate({ listId: activeListId });
          break;
        }

        case "LIST_UPDATED": {
          // Authoritative list refresh
          utilsRef.current.todoList.list.invalidate();
          break;
        }

        case "LIST_DELETED": {
          // Clean up local cache and indicate unavailable
          subscriptionRef.current?.unsubscribe();
          subscriptionRef.current = null;
          setStatus("UNAVAILABLE");
          setRawPresences([]);
          utilsRef.current.todo.list.setData({ listId: activeListId, ...activeFilters }, () => []);
          utilsRef.current.todoList.list.invalidate();
          break;
        }

        case "COLLABORATOR_CHANGED": {
          const payload = envelope.payload as CollaboratorChangedPayload;
          // If current user had their membership revoked, immediately tear down subscription and clear protected data
          if (
            payload.action === "REMOVED" &&
            currentUserId &&
            payload.targetUserId === currentUserId
          ) {
            subscriptionRef.current?.unsubscribe();
            subscriptionRef.current = null;
            setStatus("UNAVAILABLE");
            setRawPresences([]);
            utilsRef.current.todo.list.setData({ listId: activeListId, ...activeFilters }, () => []);
            utilsRef.current.todoList.list.invalidate();
          } else {
            utilsRef.current.sharing.getMembersAndInvites.invalidate({ listId: activeListId });
          }
          break;
        }

        default:
          break;
      }
    },
    [tabSessionId, triggerActivity, matchesActiveFilters]
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

  // Establish private channel lifecycle (strictly decoupled from activeView / editingTodoId)
  useEffect(() => {
    if (!listId || !authData?.authorized || isAuthError) {
      setStatus(isAuthError ? "UNAVAILABLE" : "IDLE");
      setRawPresences([]);
      return;
    }

    const activeListId = listId;

    const user = currentUserRef.current;
    const initialPresence: CollaboratorPresenceState | undefined = user
      ? {
          userId: user.id,
          sessionId: tabSessionId,
          displayName: user.displayName || "Collaborator",
          avatarUrl: user.avatarUrl,
          role: effectiveRoleRef.current,
          activeView: activeViewRef.current,
          editingTodoId: editingTodoIdRef.current,
          onlineAt: new Date().toISOString(),
        }
      : undefined;

    const subscription = subscribeToListChannel({
      listId: activeListId,
      initialPresence,
      onEvent: handleRealtimeEvent,
      onPresenceSync: (presences) => {
        setRawPresences(presences);
      },
      onPresenceJoin: (newPresences) => {
        const currentUserId = currentUserRef.current?.id;
        const other = newPresences.find((p) => p.userId !== currentUserId);
        if (other) {
          triggerActivity({
            type: "COLLABORATOR_JOINED",
            message: `${other.displayName || "A collaborator"} joined`,
            actorName: other.displayName,
          });
        }
      },
      onPresenceLeave: (leftPresences) => {
        const currentUserId = currentUserRef.current?.id;
        const other = leftPresences.find((p) => p.userId !== currentUserId);
        if (other) {
          triggerActivity({
            type: "COLLABORATOR_LEFT",
            message: `${other.displayName || "A collaborator"} left`,
            actorName: other.displayName,
          });
        }
      },
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
      onReconnected: () => {
        // Authoritative reconciliation on reconnection after packet loss or network drop
        utilsRef.current.todo.list.invalidate({ listId: activeListId });
        utilsRef.current.todoList.list.invalidate();
        utilsRef.current.sharing.getMembersAndInvites.invalidate({ listId: activeListId });
      },
    });
    subscriptionRef.current = subscription;

    // Visibility-change listener: Reconcile board queries when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        if (now - lastVisibilityRef.current > 2000) {
          lastVisibilityRef.current = now;
          utilsRef.current.todo.list.invalidate({ listId: activeListId });
          utilsRef.current.todoList.list.invalidate();
        }
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
    currentUser?.id,
    tabSessionId,
    handleRealtimeEvent,
    triggerActivity,
  ]);

  // Synchronize presence metadata without reconnecting channel
  useEffect(() => {
    if (subscriptionRef.current && status === "CONNECTED") {
      subscriptionRef.current.updatePresence({
        activeView,
        editingTodoId,
        role: effectiveRole,
      });
    }
  }, [activeView, editingTodoId, effectiveRole, status]);

  return {
    status,
    collaborators: uniqueCollaborators,
    tabSessionId,
    recentActivity,
    dismissActivity,
    updatePresence: useCallback((partial: Partial<CollaboratorPresenceState>) => {
      subscriptionRef.current?.updatePresence(partial);
    }, []),
  };
}
