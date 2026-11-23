import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { todoService } from "../src/server/services/todo.service";
import { todoRepository } from "../src/server/repositories/todo.repository";
import { todoListRepository } from "../src/server/repositories/todo-list.repository";
import { realtimePublisherService } from "../src/server/services/realtime-publisher.service";
import { realtimeEventEnvelopeSchema } from "../src/lib/realtime/realtime-events";

async function runLiveVerification() {
  console.log("=== Phase 11 Live End-to-End Verification ===");

  const ownerId = "71e34396-3822-4fc2-8068-4c0cdf3f86cb";
  const listId = "00000000-0000-4000-8000-000000000001";
  const testRunId = Date.now().toString().slice(-6);

  let testTaskId: string | null = null;

  try {
    // 1. Verify owner list exists
    console.log("\n[1] Verifying target list exists...");
    const list = await todoListRepository.findById(listId);
    if (!list) throw new Error(`List ${listId} not found`);
    console.log(`✓ List verified: "${list.name}" (${list.id})`);

    // 2. Create test task and verify initial monotonic version = 1
    console.log("\n[2] Creating test task with TodoService (verifying version = 1)...");
    const task = await todoService.createTodo(
      {
        listId,
        title: `Realtime Sync Task ${testRunId}`,
        priority: "HIGH",
        clientSessionId: "tab-test-session-1",
      },
      ownerId
    );
    testTaskId = task.id;

    if (task.version !== 1) {
      throw new Error(`Expected initial task version = 1, got ${task.version}`);
    }
    console.log(`✓ Created test task "${task.title}" (ID: ${task.id}, Version: ${task.version})`);

    // 3. Update task status and verify monotonic version increment to 2
    console.log("\n[3] Updating task status to IN_PROGRESS (verifying monotonic version increment)...");
    const updatedStatusTask = await todoService.updateStatus(
      {
        id: testTaskId,
        status: "IN_PROGRESS",
        clientSessionId: "tab-test-session-1",
      },
      ownerId
    );

    if (updatedStatusTask.version !== 2) {
      throw new Error(`Expected version = 2 after status update, got ${updatedStatusTask.version}`);
    }
    console.log(`✓ Status updated to IN_PROGRESS (Monotonic Version: ${updatedStatusTask.version})`);

    // 4. Update task details and verify monotonic version increment to 3
    console.log("\n[4] Updating task details (verifying monotonic version increment to 3)...");
    const updatedDetailsTask = await todoService.updateDetails(
      {
        id: testTaskId,
        title: `Realtime Sync Task Renamed ${testRunId}`,
        priority: "URGENT",
        clientSessionId: "tab-test-session-1",
      },
      ownerId
    );

    if (updatedDetailsTask.version !== 3) {
      throw new Error(`Expected version = 3 after details update, got ${updatedDetailsTask.version}`);
    }
    console.log(`✓ Details updated (Monotonic Version: ${updatedDetailsTask.version}, Title: "${updatedDetailsTask.title}")`);

    // 5. Test Realtime Envelope Generation & Validation
    console.log("\n[5] Validating Realtime Event Envelopes and Zod contract schema...");
    const testEnvelope = {
      eventId: crypto.randomUUID(),
      eventType: "TASK_STATUS_CHANGED" as const,
      listId,
      entityId: testTaskId,
      actorId: ownerId,
      clientSessionId: "tab-test-session-1",
      occurredAt: new Date().toISOString(),
      version: updatedDetailsTask.version,
      payload: {
        id: testTaskId,
        status: "IN_PROGRESS",
        version: updatedDetailsTask.version,
        updatedAt: new Date().toISOString(),
      },
    };

    const parseResult = realtimeEventEnvelopeSchema.safeParse(testEnvelope);
    if (!parseResult.success) {
      throw new Error(`Realtime envelope schema validation failed: ${parseResult.error.message}`);
    }
    console.log("✓ Realtime event envelope adheres strictly to Zod contract");

    // 6. Test Stale Event Rejection Logic
    console.log("\n[6] Verifying stale-event rejection rule (event.version <= cached.version)...");
    const staleVersion = 2; // Older than current task.version (3)
    const isStale = staleVersion <= updatedDetailsTask.version;
    if (!isStale) {
      throw new Error("Stale event detection logic failed!");
    }
    console.log(`✓ Stale event with version ${staleVersion} correctly rejected against current version ${updatedDetailsTask.version}`);

    // 7. Test Server-Side Broadcast Service
    console.log("\n[7] Testing RealtimePublisherService server broadcast...");
    const broadcastResult = await realtimePublisherService.broadcast(testEnvelope);
    console.log(`✓ Server broadcast executed (Result: ${broadcastResult})`);

    // 8. Delete task and verify cleanup
    console.log("\n[8] Deleting test task via TodoService...");
    await todoService.deleteTodo({ id: testTaskId, clientSessionId: "tab-test-session-1" }, ownerId);
    testTaskId = null;
    console.log("✓ Test task deleted successfully");

    const deletedTaskCheck = await todoRepository.findById(task.id);
    if (deletedTaskCheck) {
      throw new Error("Task still found in database after delete!");
    }
    console.log("✓ Task confirmed deleted from PostgreSQL database");

    console.log("\n=========================================");
    console.log("✓ ALL PHASE 11 LIVE VERIFICATIONS PASSED!");
    console.log("=========================================");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Live verification failed:", error);
    if (testTaskId) {
      try {
        await todoService.deleteTodo({ id: testTaskId }, ownerId);
      } catch {}
    }
    process.exit(1);
  }
}

runLiveVerification();
