import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { todoService } from "../src/server/services/todo.service";
import { tagService } from "../src/server/services/tag.service";
import { todoListRepository } from "../src/server/repositories/todo-list.repository";
import { ValidationError } from "../src/server/errors";

async function runLiveVerification() {
  console.log("=== Phase 8 Live End-to-End Verification ===");

  const ownerId = "71e34396-3822-4fc2-8068-4c0cdf3f86cb";
  const listId = "00000000-0000-4000-8000-000000000001";
  const testRunId = Date.now().toString().slice(-6);

  const createdTagIds: string[] = [];
  const createdTaskIds: string[] = [];

  try {
    // 1. Verify owner list exists
    console.log("\n[1] Verifying target list exists...");
    const list = await todoListRepository.findById(listId);
    if (!list) throw new Error(`List ${listId} not found`);
    console.log(`✓ List verified: "${list.name}" (${list.id})`);

    // 2. Create test tags
    console.log("\n[2] Creating color-coded tags via TagService...");
    const tagFrontend = await tagService.createTag(
      { listId, name: `Frontend-${testRunId}`, color: "blue" },
      ownerId
    );
    createdTagIds.push(tagFrontend.id);
    console.log(`✓ Created Tag: "${tagFrontend.name}" (${tagFrontend.color}, ID: ${tagFrontend.id})`);

    const tagBackend = await tagService.createTag(
      { listId, name: `Backend-${testRunId}`, color: "emerald" },
      ownerId
    );
    createdTagIds.push(tagBackend.id);
    console.log(`✓ Created Tag: "${tagBackend.name}" (${tagBackend.color}, ID: ${tagBackend.id})`);

    const tagUrgent = await tagService.createTag(
      { listId, name: `Urgent-${testRunId}`, color: "red" },
      ownerId
    );
    createdTagIds.push(tagUrgent.id);
    console.log(`✓ Created Tag: "${tagUrgent.name}" (${tagUrgent.color}, ID: ${tagUrgent.id})`);

    // 3. Verify duplicate prevention (case-insensitive)
    console.log("\n[3] Testing duplicate tag name prevention (case-insensitive)...");
    try {
      await tagService.createTag(
        { listId, name: `frontend-${testRunId}`, color: "pink" },
        ownerId
      );
      throw new Error("Duplicate tag creation should have failed!");
    } catch (err: any) {
      if (err instanceof ValidationError) {
        console.log(`✓ Successfully rejected duplicate tag name: "${err.message}"`);
      } else {
        throw err;
      }
    }

    // 4. Create tasks with assigned tags
    console.log("\n[4] Creating tasks with assigned tags...");
    const taskA = await todoService.createTodo(
      {
        listId,
        title: `Task A (Frontend + Urgent) ${testRunId}`,
        priority: "HIGH",
        tagIds: [tagFrontend.id, tagUrgent.id],
      },
      ownerId
    );
    createdTaskIds.push(taskA.id);
    console.log(`✓ Created Task A with ${taskA.tags.length} tags: [${taskA.tags.map((t) => t.name).join(", ")}]`);

    const taskB = await todoService.createTodo(
      {
        listId,
        title: `Task B (Backend + Urgent) ${testRunId}`,
        priority: "MEDIUM",
        tagIds: [tagBackend.id, tagUrgent.id],
      },
      ownerId
    );
    createdTaskIds.push(taskB.id);
    console.log(`✓ Created Task B with ${taskB.tags.length} tags: [${taskB.tags.map((t) => t.name).join(", ")}]`);

    const taskC = await todoService.createTodo(
      {
        listId,
        title: `Task C (Frontend only) ${testRunId}`,
        priority: "LOW",
        tagIds: [tagFrontend.id],
      },
      ownerId
    );
    createdTaskIds.push(taskC.id);
    console.log(`✓ Created Task C with ${taskC.tags.length} tags: [${taskC.tags.map((t) => t.name).join(", ")}]`);

    // 5. Test Multi-Tag Filtering (AND vs OR)
    console.log("\n[5] Testing multi-tag filtering semantics...");

    // Filter AND: Frontend + Urgent -> should match only Task A
    const andResults = await todoService.getTodosByList(
      {
        listId,
        tagIds: [tagFrontend.id, tagUrgent.id],
        tagOperator: "AND",
        search: testRunId,
      },
      ownerId
    );
    console.log(`✓ AND filter [Frontend + Urgent]: found ${andResults.length} task(s)`);
    if (andResults.length !== 1 || andResults[0]?.id !== taskA.id) {
      throw new Error(`Expected only Task A for AND filter, got ${andResults.map((t) => t.title).join(", ")}`);
    }

    // Filter OR: Frontend + Backend -> should match Task A, Task B, Task C
    const orResults = await todoService.getTodosByList(
      {
        listId,
        tagIds: [tagFrontend.id, tagBackend.id],
        tagOperator: "OR",
        search: testRunId,
      },
      ownerId
    );
    console.log(`✓ OR filter [Frontend | Backend]: found ${orResults.length} task(s)`);
    if (orResults.length !== 3) {
      throw new Error(`Expected 3 tasks for OR filter, got ${orResults.length}`);
    }

    // Filter Single: Backend only -> should match Task B
    const singleResults = await todoService.getTodosByList(
      {
        listId,
        tagIds: [tagBackend.id],
        tagOperator: "AND",
        search: testRunId,
      },
      ownerId
    );
    console.log(`✓ Single filter [Backend]: found ${singleResults.length} task(s)`);
    if (singleResults.length !== 1 || singleResults[0]?.id !== taskB.id) {
      throw new Error(`Expected only Task B for Backend filter, got ${singleResults.map((t) => t.title).join(", ")}`);
    }

    // 6. Test Task Tag Updating
    console.log("\n[6] Testing updating assigned tags on Task C...");
    const updatedTaskC = await todoService.updateDetails(
      {
        id: taskC.id,
        tagIds: [tagBackend.id],
      },
      ownerId
    );
    console.log(`✓ Updated Task C tags: [${updatedTaskC.tags.map((t) => t.name).join(", ")}]`);
    if (updatedTaskC.tags.length !== 1 || updatedTaskC.tags[0]?.id !== tagBackend.id) {
      throw new Error("Task C tag update failed to reflect new assigned tags");
    }

    // 7. Test Tag Updating (rename and recolor)
    console.log("\n[7] Testing tag update (rename and recolor)...");
    const updatedTagFrontend = await tagService.updateTag(
      {
        id: tagFrontend.id,
        name: `UI-Design-${testRunId}`,
        color: "purple",
      },
      ownerId
    );
    console.log(`✓ Tag updated: "${updatedTagFrontend.name}" (${updatedTagFrontend.color})`);

    // 8. Test Tag Deletion with Cascade Join Cleanup
    console.log("\n[8] Testing tag deletion and cascade disassociation from tasks...");
    await tagService.deleteTag(tagUrgent.id, ownerId);
    console.log(`✓ Deleted Tag: Urgent-${testRunId}`);

    // Verify Task A still exists but no longer has the Urgent tag
    const refreshedTaskA = await todoService.getTodosByList(
      {
        listId,
        search: `Task A (Frontend + Urgent) ${testRunId}`,
      },
      ownerId
    );
    if (refreshedTaskA.length !== 1) {
      throw new Error("Task A should still exist after tag deletion");
    }
    const hasUrgent = refreshedTaskA[0]?.tags.some((t) => t.id === tagUrgent.id);
    if (hasUrgent) {
      throw new Error("Task A still retains deleted tag in join table!");
    }
    console.log(`✓ Task A confirmed intact without deleted tag. Remaining tags: [${refreshedTaskA[0]?.tags.map((t) => t.name).join(", ")}]`);

    console.log("\n=== ALL PHASE 8 LIVE VERIFICATIONS PASSED SUCCESSFULLY ===");
  } finally {
    // Cleanup
    console.log("\n[Cleanup] Cleaning up live test entities...");
    for (const taskId of createdTaskIds) {
      try {
        await todoService.deleteTodo({ id: taskId }, ownerId);
      } catch {}
    }
    for (const tagId of createdTagIds) {
      try {
        await tagService.deleteTag(tagId, ownerId);
      } catch {}
    }
    console.log("✓ Live test entities cleaned up.");
  }
}

runLiveVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Live verification failed:", err);
    process.exit(1);
  });
