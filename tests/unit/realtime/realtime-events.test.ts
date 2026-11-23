import { describe, it, expect } from "vitest";
import {
  realtimeEventEnvelopeSchema,
  getListRealtimeTopic,
  type RealtimeEventEnvelope,
} from "@/lib/realtime/realtime-events";

describe("Realtime Events and Schema Validations", () => {
  const sampleListId = "11111111-1111-4111-8111-111111111111";
  const sampleTodoId = "22222222-2222-4222-8222-222222222222";
  const sampleActorId = "33333333-3333-4333-8333-333333333333";
  const sampleEventId = "44444444-4444-4444-8444-444444444444";

  it("should generate correct private channel topic", () => {
    const topic = getListRealtimeTopic(sampleListId);
    expect(topic).toBe(`realtime:list:${sampleListId}`);
  });

  it("should validate a valid TASK_CREATED envelope", () => {
    const validEnvelope: RealtimeEventEnvelope = {
      eventId: sampleEventId,
      eventType: "TASK_CREATED",
      listId: sampleListId,
      entityId: sampleTodoId,
      actorId: sampleActorId,
      clientSessionId: "tab-session-123",
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: { id: sampleTodoId, title: "Test Task", status: "TODO" },
    };

    const parsed = realtimeEventEnvelopeSchema.safeParse(validEnvelope);
    expect(parsed.success).toBe(true);
  });

  it("should validate a valid TASK_STATUS_CHANGED envelope", () => {
    const validEnvelope: RealtimeEventEnvelope = {
      eventId: sampleEventId,
      eventType: "TASK_STATUS_CHANGED",
      listId: sampleListId,
      entityId: sampleTodoId,
      actorId: sampleActorId,
      clientSessionId: null,
      occurredAt: new Date().toISOString(),
      version: 2,
      payload: { id: sampleTodoId, status: "IN_PROGRESS", version: 2 },
    };

    const parsed = realtimeEventEnvelopeSchema.safeParse(validEnvelope);
    expect(parsed.success).toBe(true);
  });

  it("should reject an envelope with an invalid UUID eventId", () => {
    const invalidEnvelope = {
      eventId: "not-a-uuid",
      eventType: "TASK_CREATED",
      listId: sampleListId,
      entityId: sampleTodoId,
      actorId: sampleActorId,
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: {},
    };

    const parsed = realtimeEventEnvelopeSchema.safeParse(invalidEnvelope);
    expect(parsed.success).toBe(false);
  });

  it("should reject an envelope with an unknown eventType", () => {
    const invalidEnvelope = {
      eventId: sampleEventId,
      eventType: "UNKNOWN_EVENT_TYPE",
      listId: sampleListId,
      entityId: sampleTodoId,
      actorId: sampleActorId,
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: {},
    };

    const parsed = realtimeEventEnvelopeSchema.safeParse(invalidEnvelope);
    expect(parsed.success).toBe(false);
  });

  it("should reject a negative version number", () => {
    const invalidEnvelope = {
      eventId: sampleEventId,
      eventType: "TASK_UPDATED",
      listId: sampleListId,
      entityId: sampleTodoId,
      actorId: sampleActorId,
      occurredAt: new Date().toISOString(),
      version: -1,
      payload: {},
    };

    const parsed = realtimeEventEnvelopeSchema.safeParse(invalidEnvelope);
    expect(parsed.success).toBe(false);
  });
});
