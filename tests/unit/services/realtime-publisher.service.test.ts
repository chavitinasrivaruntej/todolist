import { describe, it, expect, vi, beforeEach } from "vitest";
import { RealtimePublisherService } from "@/server/services/realtime-publisher.service";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("RealtimePublisherService", () => {
  let mockChannel: any;
  let mockSupabase: any;
  let service: RealtimePublisherService;

  const sampleListId = "11111111-1111-4111-8111-111111111111";
  const sampleTodoId = "22222222-2222-4222-8222-222222222222";
  const sampleActorId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    mockChannel = {
      send: vi.fn().mockResolvedValue("ok"),
    };

    mockSupabase = {
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn(),
    };

    service = new RealtimePublisherService(mockSupabase as unknown as SupabaseClient);
  });

  it("should broadcast a TASK_CREATED event over the list private channel", async () => {
    const todoPayload = {
      id: sampleTodoId,
      listId: sampleListId,
      title: "Realtime Task",
      description: null,
      status: "TODO" as const,
      priority: "MEDIUM" as const,
      dueDate: null,
      recurrenceRuleId: null,
      occurrenceNumber: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
    };

    const success = await service.publishTaskCreated(
      sampleListId,
      sampleActorId,
      "tab-123",
      todoPayload
    );

    expect(success).toBe(true);
    expect(mockSupabase.channel).toHaveBeenCalledWith(`realtime:list:${sampleListId}`, {
      config: {
        private: true,
        broadcast: { self: true },
      },
    });
    expect(mockChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "broadcast",
        event: "TASK_CREATED",
        payload: expect.objectContaining({
          eventType: "TASK_CREATED",
          listId: sampleListId,
          entityId: sampleTodoId,
          actorId: sampleActorId,
          clientSessionId: "tab-123",
          version: 1,
        }),
      })
    );
    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });

  it("should broadcast a TASK_STATUS_CHANGED event", async () => {
    const success = await service.publishTaskStatusChanged(
      sampleListId,
      sampleActorId,
      null,
      sampleTodoId,
      "IN_PROGRESS",
      2,
      new Date().toISOString()
    );

    expect(success).toBe(true);
    expect(mockChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "TASK_STATUS_CHANGED",
        payload: expect.objectContaining({
          version: 2,
          payload: expect.objectContaining({
            status: "IN_PROGRESS",
            version: 2,
          }),
        }),
      })
    );
  });

  it("should broadcast a TASK_DELETED event", async () => {
    const success = await service.publishTaskDeleted(
      sampleListId,
      sampleActorId,
      "tab-xyz",
      sampleTodoId,
      3
    );

    expect(success).toBe(true);
    expect(mockChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "TASK_DELETED",
        payload: expect.objectContaining({
          entityId: sampleTodoId,
          clientSessionId: "tab-xyz",
          version: 3,
        }),
      })
    );
  });

  it("should handle broadcast failure gracefully without throwing", async () => {
    mockChannel.send.mockRejectedValue(new Error("Network timeout"));

    const success = await service.publishTaskDeleted(
      sampleListId,
      sampleActorId,
      null,
      sampleTodoId,
      1
    );

    expect(success).toBe(false);
  });
});
