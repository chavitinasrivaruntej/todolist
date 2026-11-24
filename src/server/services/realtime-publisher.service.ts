import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  type RealtimeEventEnvelope,
  type TaskCreatedPayload,
  type TaskUpdatedPayload,
  type TaskStatusChangedPayload,
  type TaskDeletedPayload,
  type TaskAttachmentUpdatedPayload,
  type RecurrenceChangedPayload,
  type ListUpdatedPayload,
  type ListDeletedPayload,
  type CollaboratorChangedPayload,
  getListRealtimeTopic,
} from "@/lib/realtime/realtime-events";
import { type TodoStatus } from "@/db/schema/todos";

export interface IRealtimePublisherService {
  broadcast<T>(envelope: RealtimeEventEnvelope<T>): Promise<boolean>;
  publishTaskCreated(
    listId: string,
    actorId: string,
    clientSessionId: string | null,
    todo: TaskCreatedPayload
  ): Promise<boolean>;
  publishTaskUpdated(
    listId: string,
    actorId: string,
    clientSessionId: string | null,
    payload: TaskUpdatedPayload
  ): Promise<boolean>;
  publishTaskStatusChanged(
    listId: string,
    actorId: string,
    clientSessionId: string | null,
    id: string,
    status: TodoStatus,
    version: number,
    updatedAt: string
  ): Promise<boolean>;
  publishTaskDeleted(
    listId: string,
    actorId: string,
    clientSessionId: string | null,
    id: string,
    version: number
  ): Promise<boolean>;
  publishTaskAttachmentUpdated(
    listId: string,
    actorId: string,
    clientSessionId: string | null,
    todoId: string,
    attachmentCount: number,
    version: number
  ): Promise<boolean>;
  publishRecurrenceChanged(
    listId: string,
    actorId: string,
    clientSessionId: string | null,
    ruleId: string,
    action: "CREATED" | "UPDATED" | "PAUSED" | "RESUMED" | "ENDED"
  ): Promise<boolean>;
  publishListUpdated(
    listId: string,
    actorId: string,
    clientSessionId: string | null,
    name: string
  ): Promise<boolean>;
  publishListDeleted(
    listId: string,
    actorId: string,
    clientSessionId: string | null
  ): Promise<boolean>;
  publishCollaboratorChanged(
    listId: string,
    actorId: string,
    clientSessionId: string | null,
    action: "ADDED" | "REMOVED" | "ROLE_UPDATED",
    targetUserId: string,
    role?: "OWNER" | "EDITOR" | "VIEWER"
  ): Promise<boolean>;
}

export class RealtimePublisherService implements IRealtimePublisherService {
  private client: SupabaseClient | null = null;

  constructor(client?: SupabaseClient) {
    if (client) {
      this.client = client;
    }
  }

  private getClient(): SupabaseClient | null {
    if (this.client) {
      return this.client;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      // In test or local environments without service role credentials, gracefully skip
      return null;
    }

    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    return this.client;
  }

  /**
   * Broadcasts a domain event over Supabase Realtime private channel.
   * Never throws errors to callers: broadcast failures are logged with structured context
   * so PostgreSQL transactions and application responses remain resilient.
   */
  async broadcast<T>(envelope: RealtimeEventEnvelope<T>): Promise<boolean> {
    try {
      const client = this.getClient();
      if (!client) {
        return false;
      }

      const topic = getListRealtimeTopic(envelope.listId);
      const channel = client.channel(topic, {
        config: {
          private: true,
          broadcast: { self: true },
        },
      });

      // Send broadcast event over channel
      const status = await channel.send({
        type: "broadcast",
        event: envelope.eventType,
        payload: envelope,
      });

      // Untrack channel to prevent memory leaks in server process
      client.removeChannel(channel);

      return status === "ok";
    } catch (err: unknown) {
      console.error("[RealtimePublisherError] Failed to broadcast realtime event:", {
        eventType: envelope.eventType,
        listId: envelope.listId,
        entityId: envelope.entityId,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  async publishTaskCreated(
    listId: string,
    actorId: string,
    clientSessionId: string | null,
    todo: TaskCreatedPayload
  ): Promise<boolean> {
    return this.broadcast({
      eventId: crypto.randomUUID(),
      eventType: "TASK_CREATED",
      listId,
      entityId: todo.id,
      actorId,
      clientSessionId,
      occurredAt: new Date().toISOString(),
      version: todo.version ?? 1,
      payload: todo,
    });
  }

  async publishTaskUpdated(
    listId: string,
    actorId: string,
    clientSessionId: string | null,
    payload: TaskUpdatedPayload
  ): Promise<boolean> {
    return this.broadcast({
      eventId: crypto.randomUUID(),
      eventType: "TASK_UPDATED",
      listId,
      entityId: payload.id,
      actorId,
      clientSessionId,
      occurredAt: new Date().toISOString(),
      version: payload.version,
      payload,
    });
  }

  async publishTaskStatusChanged(
    listId: string,
    actorId: string,
    clientSessionId: string | null,
    id: string,
    status: TodoStatus,
    version: number,
    updatedAt: string
  ): Promise<boolean> {
    return this.broadcast<TaskStatusChangedPayload>({
      eventId: crypto.randomUUID(),
      eventType: "TASK_STATUS_CHANGED",
      listId,
      entityId: id,
      actorId,
      clientSessionId,
      occurredAt: new Date().toISOString(),
      version,
      payload: {
        id,
        status,
        version,
        updatedAt,
      },
    });
  }

  async publishTaskDeleted(
    listId: string,
    actorId: string,
    clientSessionId: string | null,
    id: string,
    version: number
  ): Promise<boolean> {
    return this.broadcast<TaskDeletedPayload>({
      eventId: crypto.randomUUID(),
      eventType: "TASK_DELETED",
      listId,
      entityId: id,
      actorId,
      clientSessionId,
      occurredAt: new Date().toISOString(),
      version,
      payload: { id, version },
    });
  }

  async publishTaskAttachmentUpdated(
    listId: string,
    actorId: string,
    clientSessionId: string | null,
    todoId: string,
    attachmentCount: number,
    version: number
  ): Promise<boolean> {
    return this.broadcast<TaskAttachmentUpdatedPayload>({
      eventId: crypto.randomUUID(),
      eventType: "TASK_ATTACHMENT_UPDATED",
      listId,
      entityId: todoId,
      actorId,
      clientSessionId,
      occurredAt: new Date().toISOString(),
      version,
      payload: {
        todoId,
        attachmentCount,
        version,
      },
    });
  }

  async publishRecurrenceChanged(
    listId: string,
    actorId: string,
    clientSessionId: string | null,
    ruleId: string,
    action: "CREATED" | "UPDATED" | "PAUSED" | "RESUMED" | "ENDED"
  ): Promise<boolean> {
    return this.broadcast<RecurrenceChangedPayload>({
      eventId: crypto.randomUUID(),
      eventType: "RECURRENCE_CHANGED",
      listId,
      entityId: ruleId,
      actorId,
      clientSessionId,
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: { ruleId, action },
    });
  }

  async publishListUpdated(
    listId: string,
    actorId: string,
    clientSessionId: string | null,
    name: string
  ): Promise<boolean> {
    return this.broadcast<ListUpdatedPayload>({
      eventId: crypto.randomUUID(),
      eventType: "LIST_UPDATED",
      listId,
      entityId: listId,
      actorId,
      clientSessionId,
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: { id: listId, name },
    });
  }

  async publishListDeleted(
    listId: string,
    actorId: string,
    clientSessionId: string | null
  ): Promise<boolean> {
    return this.broadcast<ListDeletedPayload>({
      eventId: crypto.randomUUID(),
      eventType: "LIST_DELETED",
      listId,
      entityId: listId,
      actorId,
      clientSessionId,
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: { id: listId },
    });
  }

  async publishCollaboratorChanged(
    listId: string,
    actorId: string,
    clientSessionId: string | null,
    action: "ADDED" | "REMOVED" | "ROLE_UPDATED",
    targetUserId: string,
    role?: "OWNER" | "EDITOR" | "VIEWER"
  ): Promise<boolean> {
    return this.broadcast<CollaboratorChangedPayload>({
      eventId: crypto.randomUUID(),
      eventType: "COLLABORATOR_CHANGED",
      listId,
      entityId: targetUserId,
      actorId,
      clientSessionId,
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: { action, targetUserId, role },
    });
  }
}

export const realtimePublisherService = new RealtimePublisherService();
