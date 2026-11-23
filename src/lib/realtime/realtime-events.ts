import { z } from "zod";
import type { TodoWithTags } from "@/server/repositories/todo.repository";
import type { TodoStatus, TodoPriority } from "@/db/schema/todos";
import type { Tag } from "@/db/schema/tags";

/**
 * Supported Realtime Domain Event Types
 */
export const REALTIME_EVENT_TYPES = [
  "TASK_CREATED",
  "TASK_UPDATED",
  "TASK_STATUS_CHANGED",
  "TASK_DELETED",
  "TASK_ATTACHMENT_UPDATED",
  "LIST_UPDATED",
  "COLLABORATOR_CHANGED",
] as const;

export type RealtimeEventType = (typeof REALTIME_EVENT_TYPES)[number];

/**
 * Standard Envelope for all Caize Todo Realtime Events
 */
export interface RealtimeEventEnvelope<T = unknown> {
  eventId: string;             // UUID v4 for client-side deduplication
  eventType: RealtimeEventType;
  listId: string;              // Partition topic scope
  entityId: string;            // Primary target entity ID (e.g. todoId, listId)
  actorId: string;             // User ID who performed the mutation
  clientSessionId: string | null; // Unique browser tab session ID of originating mutation
  occurredAt: string;          // ISO 8601 timestamp
  version: number;             // Monotonic entity version for stale-event rejection
  payload: T;                  // Typed event payload
}

/**
 * Payload Schemas and Types
 */

export interface TaskCreatedPayload extends TodoWithTags {}

export interface TaskUpdatedPayload {
  id: string;
  title: string;
  description: string | null;
  priority: TodoPriority;
  dueDate: string | null;
  tags: Tag[];
  attachmentCount?: number;
  version: number;
  updatedAt: string;
}

export interface TaskStatusChangedPayload {
  id: string;
  status: TodoStatus;
  version: number;
  updatedAt: string;
}

export interface TaskDeletedPayload {
  id: string;
}

export interface TaskAttachmentUpdatedPayload {
  todoId: string;
  attachmentCount: number;
  version: number;
}

export interface ListUpdatedPayload {
  id: string;
  name: string;
}

export interface CollaboratorChangedPayload {
  action: "ADDED" | "REMOVED" | "ROLE_UPDATED";
  targetUserId: string;
  role?: "OWNER" | "EDITOR" | "VIEWER";
}

/**
 * Privacy-Minimizing Presence State for Active Collaborators
 * (Notice: email is strictly omitted)
 */
export interface CollaboratorPresenceState {
  userId: string;
  sessionId: string;
  displayName: string;
  avatarUrl?: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  activeView: "list" | "board" | "activity";
  editingTodoId?: string | null;
  onlineAt: string;
}

/**
 * Zod validation schema for event envelopes
 */
export const realtimeEventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.enum(REALTIME_EVENT_TYPES),
  listId: z.string().uuid(),
  entityId: z.string(),
  actorId: z.string(),
  clientSessionId: z.string().nullable().optional(),
  occurredAt: z.string(),
  version: z.number().int().nonnegative(),
  payload: z.unknown(),
});

/**
 * Helper to generate private channel topic string
 */
export function getListRealtimeTopic(listId: string): string {
  return `realtime:list:${listId}`;
}
