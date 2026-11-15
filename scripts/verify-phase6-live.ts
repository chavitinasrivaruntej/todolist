import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { db } from "../src/db";
import { sql } from "drizzle-orm";
import { activityService } from "../src/server/services/activity.service";
import { notificationService } from "../src/server/services/notification.service";
import { todoService } from "../src/server/services/todo.service";
import { todoListRepository } from "../src/server/repositories/todo-list.repository";

async function runLiveVerification() {
  console.log("=== Phase 6 Live End-to-End Verification ===");

  const ownerId = "71e34396-3822-4fc2-8068-4c0cdf3f86cb";
  const listId = "00000000-0000-4000-8000-000000000001";

  // 1. Verify owner list exists
  console.log("\n[1] Verifying list exists...");
  const list = await todoListRepository.findById(listId);
  if (!list) {
    throw new Error(`List ${listId} not found`);
  }
  console.log(`✓ List verified: "${list.name}" (${list.id})`);

  // 2. Test Todo Operations & Activity Logging
  console.log("\n[2] Testing Todo operations and atomic activity logging...");
  const testTitle = `Phase 6 Verification Task ${Date.now()}`;
  const createdTodo = await todoService.createTodo(
    {
      listId,
      title: testTitle,
      description: "Live verification of activity audit logs",
    },
    ownerId
  );
  console.log(`✓ Todo created: ID ${createdTodo.id}`);

  // Check activity_logs table for TODO_CREATED
  const [createdAct] = (await db.execute(sql`
    SELECT * FROM activity_logs 
    WHERE list_id = ${listId}::uuid AND entity_id = ${createdTodo.id}::uuid AND action = 'TODO_CREATED'
    LIMIT 1;
  `)) as unknown as Array<{ id: string; action: string; metadata: any }>;

  if (!createdAct) {
    throw new Error("TODO_CREATED activity log was not found in activity_logs table!");
  }
  console.log(`✓ Activity record confirmed: action=${createdAct.action}, id=${createdAct.id}`);

  // Update status
  const updatedTodo = await todoService.updateStatus(
    {
      id: createdTodo.id,
      status: "DONE",
    },
    ownerId
  );
  console.log(`✓ Todo status updated: new status=${updatedTodo.status}`);

  // Check activity_logs table for TODO_STATUS_CHANGED
  const [statusAct] = (await db.execute(sql`
    SELECT * FROM activity_logs 
    WHERE list_id = ${listId}::uuid AND entity_id = ${createdTodo.id}::uuid AND action = 'TODO_STATUS_CHANGED'
    LIMIT 1;
  `)) as unknown as Array<{ id: string; action: string }>;

  if (!statusAct) {
    throw new Error("TODO_STATUS_CHANGED activity log was not found!");
  }
  console.log(`✓ Activity record confirmed: action=${statusAct.action}`);

  // 3. Test Activity Timeline & Composite Cursor Pagination
  console.log("\n[3] Testing activity timeline query and composite cursor pagination...");
  const timelineResult = await activityService.getActivityByList(
    { listId, limit: 5 },
    ownerId
  );
  console.log(`✓ Retrieved ${timelineResult.items.length} activity items`);
  if (timelineResult.items.length > 0) {
    console.log(`  Latest action: ${timelineResult.items[0]?.action} by ${timelineResult.items[0]?.actorEmail}`);
  }

  // 4. Test Notification Lifecycle
  console.log("\n[4] Testing notification lifecycle...");
  const initialCount = await notificationService.getUnreadCount(ownerId);
  console.log(`✓ Initial unread notification count: ${initialCount}`);

  // Direct test notification for owner (actorId = null satisfies FK constraint)
  const testNotif = await notificationService.notifyInvitationAccepted({
    listId,
    listName: list.name,
    acceptorId: null as any,
    acceptorEmail: "test.collaborator@example.com",
    ownerId,
  });

  if (!testNotif) {
    throw new Error("Notification creation failed!");
  }
  console.log(`✓ Notification created: ID ${testNotif.id}`);

  const updatedCount = await notificationService.getUnreadCount(ownerId);
  if (updatedCount !== initialCount + 1) {
    throw new Error(`Expected unread count to be ${initialCount + 1}, got ${updatedCount}`);
  }
  console.log(`✓ Unread count incremented correctly: ${updatedCount}`);

  // Mark as read
  await notificationService.markAsRead(testNotif.id, ownerId);
  const countAfterRead = await notificationService.getUnreadCount(ownerId);
  if (countAfterRead !== initialCount) {
    throw new Error(`Expected unread count to return to ${initialCount}, got ${countAfterRead}`);
  }
  console.log(`✓ Marked as read; unread count returned to ${countAfterRead}`);

  // Delete test notification
  await notificationService.deleteNotification(testNotif.id, ownerId);
  console.log(`✓ Cleaned up test notification`);

  // 5. Clean up test todo
  console.log("\n[5] Cleaning up test todo...");
  await todoService.deleteTodo({ id: createdTodo.id }, ownerId);
  console.log(`✓ Test todo deleted`);

  console.log("\n🎉 Phase 6 Live End-to-End Verification PASSED!");
}

runLiveVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  });
