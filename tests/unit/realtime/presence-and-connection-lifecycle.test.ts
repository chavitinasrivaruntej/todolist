import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRealtimeBoard, type UniqueCollaborator } from "@/hooks/use-realtime-board";
import * as realtimeClient from "@/lib/realtime/realtime-client";
import type { RealtimeEventEnvelope, CollaboratorPresenceState } from "@/lib/realtime/realtime-events";

// Mock tRPC
const mockInvalidateTodoList = vi.fn();
const mockInvalidateTodoListQueries = vi.fn();
const mockInvalidateSharing = vi.fn();
const mockSetTodoData = vi.fn();

let mockAuthorizeResult = {
  data: { authorized: true, role: "OWNER" as const },
  isError: false,
};

vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    useUtils: () => ({
      todo: {
        list: {
          invalidate: mockInvalidateTodoList,
          setData: mockSetTodoData,
        },
      },
      todoList: {
        list: {
          invalidate: mockInvalidateTodoListQueries,
        },
      },
      sharing: {
        getMembersAndInvites: {
          invalidate: mockInvalidateSharing,
        },
      },
    }),
    realtime: {
      authorizeChannel: {
        useQuery: () => mockAuthorizeResult,
      },
    },
  },
}));

describe("Stage 3: Presence and Connection Lifecycle", () => {
  let capturedOptions: realtimeClient.CreateChannelOptions | null = null;
  let mockUpdatePresence: ReturnType<typeof vi.fn>;
  let mockUnsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOptions = null;
    mockUpdatePresence = vi.fn().mockImplementation(async () => {});
    mockUnsubscribe = vi.fn();
    mockAuthorizeResult = {
      data: { authorized: true, role: "OWNER" },
      isError: false,
    };

    vi.spyOn(realtimeClient, "subscribeToListChannel").mockImplementation((options) => {
      capturedOptions = options;
      return {
        channel: null,
        updatePresence: mockUpdatePresence as unknown as (partial: Partial<CollaboratorPresenceState>) => Promise<void>,
        unsubscribe: mockUnsubscribe as unknown as () => void,
      };
    });
  });

  describe("1. Presence & Multi-Tab Grouping", () => {
    it("should group multiple browser tabs for the same user into a single collaborator with sessionCount", () => {
      const { result } = renderHook(() =>
        useRealtimeBoard({
          listId: "list-1",
          currentUser: { id: "user-1", displayName: "Alice" },
        })
      );

      expect(capturedOptions).not.toBeNull();

      // Simulate Supabase presence sync with two tabs from Alice and one from Bob
      const presences: CollaboratorPresenceState[] = [
        {
          userId: "user-1",
          sessionId: "tab-alice-1",
          displayName: "Alice",
          role: "OWNER",
          activeView: "list",
          onlineAt: new Date().toISOString(),
        },
        {
          userId: "user-1",
          sessionId: "tab-alice-2",
          displayName: "Alice",
          role: "OWNER",
          activeView: "board",
          onlineAt: new Date().toISOString(),
        },
        {
          userId: "user-2",
          sessionId: "tab-bob-1",
          displayName: "Bob",
          role: "EDITOR",
          activeView: "list",
          onlineAt: new Date().toISOString(),
        },
      ];

      act(() => {
        capturedOptions?.onPresenceSync(presences);
      });

      expect(result.current.collaborators).toHaveLength(2);

      const alice = result.current.collaborators.find((c: UniqueCollaborator) => c.userId === "user-1");
      expect(alice).toBeDefined();
      expect(alice?.sessionCount).toBe(2);

      const bob = result.current.collaborators.find((c: UniqueCollaborator) => c.userId === "user-2");
      expect(bob).toBeDefined();
      expect(bob?.sessionCount).toBe(1);
    });

    it("should maintain presence when one tab closes as long as another tab remains open", () => {
      const { result } = renderHook(() =>
        useRealtimeBoard({
          listId: "list-1",
          currentUser: { id: "user-1", displayName: "Alice" },
        })
      );

      // Alice has two tabs open
      act(() => {
        capturedOptions?.onPresenceSync([
          {
            userId: "user-1",
            sessionId: "tab-1",
            displayName: "Alice",
            role: "OWNER",
            activeView: "list",
            onlineAt: new Date().toISOString(),
          },
          {
            userId: "user-1",
            sessionId: "tab-2",
            displayName: "Alice",
            role: "OWNER",
            activeView: "board",
            onlineAt: new Date().toISOString(),
          },
        ]);
      });

      expect(result.current.collaborators[0]?.sessionCount).toBe(2);

      // Tab 1 closes -> only Tab 2 remains
      act(() => {
        capturedOptions?.onPresenceSync([
          {
            userId: "user-1",
            sessionId: "tab-2",
            displayName: "Alice",
            role: "OWNER",
            activeView: "board",
            onlineAt: new Date().toISOString(),
          },
        ]);
      });

      expect(result.current.collaborators).toHaveLength(1);
      expect(result.current.collaborators[0]?.sessionCount).toBe(1);
      expect(result.current.collaborators[0]?.userId).toBe("user-1");
    });

    it("should remove user completely when all of their tabs disconnect", () => {
      const { result } = renderHook(() =>
        useRealtimeBoard({
          listId: "list-1",
          currentUser: { id: "user-1", displayName: "Alice" },
        })
      );

      act(() => {
        capturedOptions?.onPresenceSync([
          {
            userId: "user-2",
            sessionId: "tab-bob-1",
            displayName: "Bob",
            role: "EDITOR",
            activeView: "list",
            onlineAt: new Date().toISOString(),
          },
        ]);
      });

      expect(result.current.collaborators).toHaveLength(1);

      // All sessions left
      act(() => {
        capturedOptions?.onPresenceSync([]);
      });

      expect(result.current.collaborators).toHaveLength(0);
    });

    it("should update presence metadata without reconnecting or tearing down the channel when activeView changes", () => {
      const { rerender } = renderHook(
        ({ view }: { view: "list" | "board" }) =>
          useRealtimeBoard({
            listId: "list-1",
            currentUser: { id: "user-1", displayName: "Alice" },
            activeView: view,
          }),
        { initialProps: { view: "list" } }
      );

      expect(realtimeClient.subscribeToListChannel).toHaveBeenCalledTimes(1);

      // Simulate connection established
      act(() => {
        capturedOptions?.onStatusChange("CONNECTED");
      });

      // User toggles from list to board view
      rerender({ view: "board" });

      // Subscription should NOT have been re-created or torn down
      expect(realtimeClient.subscribeToListChannel).toHaveBeenCalledTimes(1);
      expect(mockUnsubscribe).not.toHaveBeenCalled();
      expect(mockUpdatePresence).toHaveBeenCalledWith({
        activeView: "board",
        editingTodoId: null,
        role: "OWNER",
      });
    });
  });

  describe("2. Connection Lifecycle & Reconnection Recovery", () => {
    it("should track status transitions through CONNECTING, CONNECTED, DISCONNECTED", () => {
      const { result } = renderHook(() =>
        useRealtimeBoard({
          listId: "list-1",
          currentUser: { id: "user-1" },
        })
      );

      act(() => {
        capturedOptions?.onStatusChange("CONNECTING");
      });
      expect(result.current.status).toBe("CONNECTING");

      act(() => {
        capturedOptions?.onStatusChange("CONNECTED");
      });
      expect(result.current.status).toBe("CONNECTED");

      act(() => {
        capturedOptions?.onStatusChange("DISCONNECTED");
      });
      expect(result.current.status).toBe("DISCONNECTED");
    });

    it("should trigger authoritative query invalidation on successful reconnection", () => {
      renderHook(() =>
        useRealtimeBoard({
          listId: "list-1",
          currentUser: { id: "user-1" },
        })
      );

      // Reconnection callback triggered
      act(() => {
        capturedOptions?.onReconnected?.();
      });

      expect(mockInvalidateTodoList).toHaveBeenCalledWith({ listId: "list-1" });
      expect(mockInvalidateTodoListQueries).toHaveBeenCalled();
      expect(mockInvalidateSharing).toHaveBeenCalledWith({ listId: "list-1" });
    });

    it("should unsubscribe and clean up previous channel subscription when listId switches", () => {
      const { rerender } = renderHook(
        ({ listId }: { listId: string }) =>
          useRealtimeBoard({
            listId,
            currentUser: { id: "user-1" },
          }),
        { initialProps: { listId: "list-1" } }
      );

      expect(mockUnsubscribe).not.toHaveBeenCalled();

      // Switch active list
      rerender({ listId: "list-2" });

      // Previous subscription must be torn down
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      expect(realtimeClient.subscribeToListChannel).toHaveBeenCalledTimes(2);
    });

    it("should immediately tear down channel and clear cache if collaborator permission is revoked", () => {
      const { result } = renderHook(() =>
        useRealtimeBoard({
          listId: "list-1",
          currentUser: { id: "user-target" },
        })
      );

      // Simulate COLLABORATOR_CHANGED (REMOVED) event targeting user-target
      const revokeEnvelope: RealtimeEventEnvelope = {
        eventId: "event-revoke-1",
        eventType: "COLLABORATOR_CHANGED",
        listId: "list-1",
        entityId: "user-target",
        actorId: "owner-user",
        clientSessionId: "owner-tab",
        occurredAt: new Date().toISOString(),
        version: 0,
        payload: {
          action: "REMOVED",
          targetUserId: "user-target",
        },
      };

      act(() => {
        capturedOptions?.onEvent(revokeEnvelope);
      });

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(result.current.status).toBe("UNAVAILABLE");
      expect(result.current.collaborators).toHaveLength(0);
      expect(mockSetTodoData).toHaveBeenCalled();
    });
  });

  describe("3. Board Cache Consistency & Late-Event Guards", () => {
    it("should prevent late creation events from resurrecting previously deleted tasks", () => {
      renderHook(() =>
        useRealtimeBoard({
          listId: "list-1",
          currentUser: { id: "user-1" },
        })
      );

      // 1. Task is deleted
      const deleteEnvelope: RealtimeEventEnvelope = {
        eventId: "event-del-1",
        eventType: "TASK_DELETED",
        listId: "list-1",
        entityId: "task-deleted-123",
        actorId: "user-2",
        clientSessionId: "tab-bob",
        occurredAt: new Date().toISOString(),
        version: 3,
        payload: { id: "task-deleted-123", version: 3 },
      };

      act(() => {
        capturedOptions?.onEvent(deleteEnvelope);
      });

      expect(mockSetTodoData).toHaveBeenCalled();
      mockSetTodoData.mockClear();

      // 2. Delayed late TASK_CREATED event arrives for the same deleted task
      const lateCreateEnvelope: RealtimeEventEnvelope = {
        eventId: "event-create-late",
        eventType: "TASK_CREATED",
        listId: "list-1",
        entityId: "task-deleted-123",
        actorId: "user-2",
        clientSessionId: "tab-bob",
        occurredAt: new Date().toISOString(),
        version: 1,
        payload: {
          id: "task-deleted-123",
          listId: "list-1",
          title: "Resurrected Task",
          status: "TODO",
          priority: "MEDIUM",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
        },
      };

      act(() => {
        capturedOptions?.onEvent(lateCreateEnvelope);
      });

      // Must be dropped; setData must NOT be called to resurrect the task
      expect(mockSetTodoData).not.toHaveBeenCalled();
    });

    it("should discard stale events whose versions are less than or equal to current cached version", () => {
      renderHook(() =>
        useRealtimeBoard({
          listId: "list-1",
          currentUser: { id: "user-1" },
        })
      );

      const statusEnvelope: RealtimeEventEnvelope = {
        eventId: "event-status-stale",
        eventType: "TASK_STATUS_CHANGED",
        listId: "list-1",
        entityId: "task-1",
        actorId: "user-2",
        clientSessionId: "tab-bob",
        occurredAt: new Date().toISOString(),
        version: 2, // Stale version <= 2
        payload: {
          id: "task-1",
          status: "DONE",
          version: 2,
          updatedAt: new Date().toISOString(),
        },
      };

      act(() => {
        capturedOptions?.onEvent(statusEnvelope);
      });

      expect(mockSetTodoData).toHaveBeenCalled();
      const updater = mockSetTodoData.mock.calls[0]?.[1];
      const existing = [{ id: "task-1", version: 3, status: "IN_PROGRESS" }];
      const result = updater(existing);

      // Stale update (v2) must NOT overwrite newer cached version (v3)
      expect(result[0].status).toBe("IN_PROGRESS");
      expect(result[0].version).toBe(3);
    });

    it("should ignore events arriving from a different list than the active list", () => {
      renderHook(() =>
        useRealtimeBoard({
          listId: "list-active",
          currentUser: { id: "user-1" },
        })
      );

      const crossListEnvelope: RealtimeEventEnvelope = {
        eventId: "event-other-list",
        eventType: "TASK_CREATED",
        listId: "list-different",
        entityId: "task-x",
        actorId: "user-2",
        clientSessionId: "tab-x",
        occurredAt: new Date().toISOString(),
        version: 1,
        payload: {
          id: "task-x",
          listId: "list-different",
          title: "Other List Task",
          status: "TODO",
          priority: "MEDIUM",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
        },
      };

      act(() => {
        capturedOptions?.onEvent(crossListEnvelope);
      });

      expect(mockSetTodoData).not.toHaveBeenCalled();
    });
  });

  describe("4. Lightweight Realtime Activity Notifications", () => {
    it("should trigger activity feedback when another collaborator creates a task", () => {
      const { result } = renderHook(() =>
        useRealtimeBoard({
          listId: "list-1",
          currentUser: { id: "user-1" },
        })
      );

      expect(result.current.recentActivity).toBeNull();

      // Incoming event from collaborator Bob
      const createEnvelope: RealtimeEventEnvelope = {
        eventId: "event-create-bob",
        eventType: "TASK_CREATED",
        listId: "list-1",
        entityId: "task-bob-1",
        actorId: "user-bob",
        clientSessionId: "tab-bob",
        occurredAt: new Date().toISOString(),
        version: 1,
        payload: {
          id: "task-bob-1",
          listId: "list-1",
          title: "Bob's New Task",
          status: "TODO",
          priority: "MEDIUM",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
        },
      };

      act(() => {
        capturedOptions?.onEvent(createEnvelope);
      });

      expect(result.current.recentActivity).not.toBeNull();
      expect(result.current.recentActivity?.type).toBe("TASK_CREATED");
      expect(result.current.recentActivity?.message).toContain("Bob's New Task");
    });

    it("should suppress activity feedback for the current user's own actions", () => {
      const { result } = renderHook(() =>
        useRealtimeBoard({
          listId: "list-1",
          currentUser: { id: "user-1" },
        })
      );

      // Event emitted by the user themselves
      const ownEnvelope: RealtimeEventEnvelope = {
        eventId: "event-own-1",
        eventType: "TASK_CREATED",
        listId: "list-1",
        entityId: "task-own-1",
        actorId: "user-1",
        clientSessionId: "tab-other-session",
        occurredAt: new Date().toISOString(),
        version: 1,
        payload: {
          id: "task-own-1",
          listId: "list-1",
          title: "My Own Task",
          status: "TODO",
          priority: "MEDIUM",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
        },
      };

      act(() => {
        capturedOptions?.onEvent(ownEnvelope);
      });

      expect(result.current.recentActivity).toBeNull();
    });

    it("should trigger activity feedback when a collaborator joins or leaves", () => {
      const { result } = renderHook(() =>
        useRealtimeBoard({
          listId: "list-1",
          currentUser: { id: "user-1" },
        })
      );

      // Collaborator joins
      act(() => {
        capturedOptions?.onPresenceJoin?.([
          {
            userId: "user-charlie",
            sessionId: "tab-c-1",
            displayName: "Charlie",
            role: "EDITOR",
            activeView: "list",
            onlineAt: new Date().toISOString(),
          },
        ]);
      });

      expect(result.current.recentActivity).not.toBeNull();
      expect(result.current.recentActivity?.type).toBe("COLLABORATOR_JOINED");
      expect(result.current.recentActivity?.message).toContain("Charlie joined");

      // Dismiss activity
      act(() => {
        result.current.dismissActivity();
      });

      expect(result.current.recentActivity).toBeNull();
    });
  });
});
