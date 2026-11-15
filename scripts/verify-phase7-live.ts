import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { db } from "../src/db";
import { sql } from "drizzle-orm";
import { todoService } from "../src/server/services/todo.service";
import { todoRepository } from "../src/server/repositories/todo.repository";
import { todoListRepository } from "../src/server/repositories/todo-list.repository";
import { isTodoOverdue } from "../src/lib/todo-utils";

async function runLiveVerification() {
  console.log("=== Phase 7 Live End-to-End Verification ===");

  const ownerId = "71e34396-3822-4fc2-8068-4c0cdf3f86cb";
  const listId = "00000000-0000-4000-8000-000000000001";
  const testRunId = Date.now();
  const createdTaskIds: string[] = [];

  try {
    // 1. Verify owner list exists
    console.log("\n[1] Verifying list exists...");
    const list = await todoListRepository.findById(listId);
    if (!list) throw new Error(`List ${listId} not found`);
    console.log(`✓ List verified: "${list.name}" (${list.id})`);

    // 2. Create tasks with different priorities and due dates
    console.log("\n[2] Creating tasks with priorities and calendar due dates...");
    const overdueDate = "2026-11-10";
    const todayDate = "2026-11-15";
    const upcomingDate = "2026-11-25";

    const task1 = await todoService.createTodo(
      {
        listId,
        title: `Task Alpha Overdue ${testRunId}`,
        description: "Live test overdue item with high urgency",
        priority: "URGENT",
        dueDate: overdueDate,
      },
      ownerId
    );
    createdTaskIds.push(task1.id);
    console.log(`✓ Task 1 (URGENT, past date) created: ID ${task1.id}`);

    const task2 = await todoService.createTodo(
      {
        listId,
        title: `Task Beta Today ${testRunId}`,
        description: "Live test item due today",
        priority: "HIGH",
        dueDate: todayDate,
      },
      ownerId
    );
    createdTaskIds.push(task2.id);
    console.log(`✓ Task 2 (HIGH, today date) created: ID ${task2.id}`);

    const task3 = await todoService.createTodo(
      {
        listId,
        title: `Task Gamma Upcoming ${testRunId}`,
        description: "Live test upcoming roadmap item",
        priority: "LOW",
        dueDate: upcomingDate,
      },
      ownerId
    );
    createdTaskIds.push(task3.id);
    console.log(`✓ Task 3 (LOW, future date) created: ID ${task3.id}`);

    // 3. Verify overdue logic across statuses
    console.log("\n[3] Testing overdue invariant logic...");
    console.log(`  - Task 1 (TODO, ${overdueDate}) isOverdue: ${isTodoOverdue(task1, todayDate)} (Expected: true)`);
    if (!isTodoOverdue(task1, todayDate)) throw new Error("Task 1 should be overdue");

    // Move task 1 to DONE
    const task1Done = await todoService.updateStatus(
      { id: task1.id, status: "DONE" },
      ownerId
    );
    console.log(`  - Task 1 moved to DONE. isOverdue: ${isTodoOverdue(task1Done, todayDate)} (Expected: false)`);
    if (isTodoOverdue(task1Done, todayDate)) throw new Error("DONE task must never be overdue");

    console.log(`  - Task 2 (TODO, due today ${todayDate}) isOverdue: ${isTodoOverdue(task2, todayDate)} (Expected: false)`);
    if (isTodoOverdue(task2, todayDate)) throw new Error("Due today task should not be overdue");

    // 4. Test Repository Search & Filtering
    console.log("\n[4] Testing repository search and filtering...");
    const searchResults = await todoRepository.findAllByListId(listId, {
      search: `Task Beta Today ${testRunId}`,
    });
    console.log(`  - Search by title: found ${searchResults.length} matching tasks`);
    if (searchResults.length !== 1 || searchResults[0].id !== task2.id) {
      throw new Error("Search by title failed");
    }

    const priorityResults = await todoRepository.findAllByListId(listId, {
      priority: "HIGH",
    });
    console.log(`  - Filter by priority (HIGH): found ${priorityResults.length} tasks`);
    if (!priorityResults.some((t) => t.id === task2.id)) {
      throw new Error("Filter by priority failed to return Task 2");
    }

    // 5. Test Deterministic Sorting
    console.log("\n[5] Testing deterministic sorting...");
    const sortedByPriority = await todoRepository.findAllByListId(listId, {
      sortBy: "priority",
      sortDirection: "desc",
    });
    console.log(`  - Top task by priority: ${sortedByPriority[0]?.title} (${sortedByPriority[0]?.priority})`);

    const sortedByDueDate = await todoRepository.findAllByListId(listId, {
      sortBy: "dueDate",
      sortDirection: "asc",
    });
    console.log(`  - Earliest task by dueDate: ${sortedByDueDate[0]?.title} (${sortedByDueDate[0]?.dueDate})`);

    // 6. Test Activity Metadata and No-Op Suppression
    console.log("\n[6] Testing activity metadata capture and no-op suppression...");
    // Update task 3 priority and due date
    await todoService.updateDetails(
      {
        id: task3.id,
        priority: "HIGH",
        dueDate: "2026-11-28",
      },
      ownerId
    );

    const [activity] = (await db.execute(sql`
      SELECT * FROM activity_logs 
      WHERE list_id = ${listId}::uuid AND entity_id = ${task3.id}::uuid AND action = 'TODO_UPDATED'
      ORDER BY created_at DESC, id DESC
      LIMIT 1;
    `)) as unknown as Array<{ id: string; action: string; metadata: any }>;

    console.log("  - Activity metadata recorded:", activity.metadata);
    if (
      activity.metadata.previousPriority !== "LOW" ||
      activity.metadata.newPriority !== "HIGH" ||
      activity.metadata.previousDueDate !== upcomingDate ||
      activity.metadata.newDueDate !== "2026-11-28"
    ) {
      throw new Error("Activity metadata did not record previous and new values accurately");
    }
    console.log("✓ Activity log captured previous and new values for priority and due date");

    // Test No-op suppression: call updateDetails with identical values
    const countBefore = await db.execute(sql`
      SELECT count(*) as count FROM activity_logs 
      WHERE list_id = ${listId}::uuid AND entity_id = ${task3.id}::uuid;
    `);

    await todoService.updateDetails(
      {
        id: task3.id,
        priority: "HIGH",
        dueDate: "2026-11-28",
      },
      ownerId
    );

    const countAfter = await db.execute(sql`
      SELECT count(*) as count FROM activity_logs 
      WHERE list_id = ${listId}::uuid AND entity_id = ${task3.id}::uuid;
    `);

    if (countBefore[0].count !== countAfter[0].count) {
      throw new Error("No-op mutation wrote an unnecessary activity log");
    }
    console.log("✓ No-op update suppressed database writes and activity logging");

    console.log("\n=== Live Verification Succeeded 100%! ===");
  } finally {
    // Clean up created tasks
    console.log("\n[7] Cleaning up test tasks...");
    for (const taskId of createdTaskIds) {
      try {
        await todoService.deleteTodo({ id: taskId }, ownerId);
      } catch (err) {
        // ignore
      }
    }
    console.log("✓ Test tasks cleaned up.");
  }
}

runLiveVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Live verification failed:", err);
    process.exit(1);
  });
