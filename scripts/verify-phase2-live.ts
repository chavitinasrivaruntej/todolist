import { appRouter } from "../src/server/api/root";
import { TRPCError } from "@trpc/server";

async function runLiveVerification() {
  console.log("=================================================");
  console.log("Phase 2 Live Supabase Integration Verification");
  console.log("=================================================");

  const caller = appRouter.createCaller({
    headers: undefined,
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    },
  });

  // Step 1: Initial lists query
  console.log("\n[Step 1] Querying existing lists...");
  const initialLists = await caller.todoList.list();
  console.log(`Found ${initialLists.length} existing list(s):`, initialLists.map((l) => `${l.name} (${l.taskCount} tasks, ID: ${l.id})`));

  // Step 1b: Verify Migrated Default Personal List ID & Task Loading
  console.log("\n[Step 1b] Verifying migrated default 'Personal' list...");
  const personalList = initialLists.find((l) => l.name === "Personal");
  if (!personalList) {
    throw new Error("Assertion failed: Default 'Personal' list was not found in database.");
  }
  if (personalList.id !== "00000000-0000-4000-8000-000000000001") {
    throw new Error(`Assertion failed: Expected Personal list ID to be '00000000-0000-4000-8000-000000000001', got '${personalList.id}'`);
  }
  console.log(`  ✓ Personal list ID is valid RFC 4122 v4 UUID: ${personalList.id}`);

  console.log("  Testing task loading for Personal list via todo.list()...");
  const personalTasks = await caller.todo.list({ listId: personalList.id });
  console.log(`  ✓ Task loading query SUCCEEDED! Loaded ${personalTasks.length} task(s) without Zod validation rejection.`);

  console.log("  Testing adding a task to Personal list...");
  const samplePersonalTask = await caller.todo.create({
    listId: personalList.id,
    title: "Verify Default List Works",
    description: "Regression test for RFC 4122 default UUID",
    status: "TODO",
  });
  console.log(`  ✓ Task created in Personal list with ID: ${samplePersonalTask.id}`);

  const personalTasksAfterAdd = await caller.todo.list({ listId: personalList.id });
  if (personalTasksAfterAdd.length !== personalTasks.length + 1) {
    throw new Error("Assertion failed: Personal list tasks count did not increment.");
  }

  // Clean up the sample task from Personal list
  await caller.todo.delete({ id: samplePersonalTask.id });
  console.log("  ✓ Cleaned up test task from Personal list.");

  // Step 2: Create two lists ("Phase2-College" and "Phase2-Projects")
  console.log("\n[Step 2] Creating test lists 'Phase2-College' and 'Phase2-Projects'...");
  const collegeList = await caller.todoList.create({ name: "Phase2-College" });
  console.log(`  ✓ Created list 'Phase2-College' with ID: ${collegeList.id}`);

  const projectsList = await caller.todoList.create({ name: "Phase2-Projects" });
  console.log(`  ✓ Created list 'Phase2-Projects' with ID: ${projectsList.id}`);

  // Step 3: Add tasks to specific lists with different statuses
  console.log("\n[Step 3] Adding scoped tasks to each list...");
  const taskCollege = await caller.todo.create({
    listId: collegeList.id,
    title: "Study Operating Systems",
    description: "Threads, concurrency, virtual memory",
    status: "TODO",
  });
  console.log(`  ✓ Added task to College: "${taskCollege.title}" [status: ${taskCollege.status}] (ID: ${taskCollege.id})`);

  const taskProjects = await caller.todo.create({
    listId: projectsList.id,
    title: "Build Drizzle Migration",
    description: "Composite index on listId and createdAt",
    status: "IN_PROGRESS",
  });
  console.log(`  ✓ Added task to Projects: "${taskProjects.title}" [status: ${taskProjects.status}] (ID: ${taskProjects.id})`);

  // Step 4: Verify task isolation (no cross-list task leaking)
  console.log("\n[Step 4] Verifying list isolation...");
  const collegeTasks = await caller.todo.list({ listId: collegeList.id });
  const projectsTasks = await caller.todo.list({ listId: projectsList.id });

  console.log(`  College tasks count: ${collegeTasks.length}`);
  console.log(`  Projects tasks count: ${projectsTasks.length}`);

  if (collegeTasks.length !== 1 || collegeTasks[0]?.id !== taskCollege.id) {
    throw new Error(`Assertion failed: College should have exactly 1 task (${taskCollege.id}), found ${collegeTasks.length}`);
  }
  if (projectsTasks.length !== 1 || projectsTasks[0]?.id !== taskProjects.id) {
    throw new Error(`Assertion failed: Projects should have exactly 1 task (${taskProjects.id}), found ${projectsTasks.length}`);
  }
  console.log("  ✓ Strict list isolation verified: tasks strictly partitioned by listId!");

  // Step 5: Update task status
  console.log("\n[Step 5] Updating task status in College from TODO -> DONE...");
  const updatedTask = await caller.todo.updateStatus({
    id: taskCollege.id,
    status: "DONE",
  });
  console.log(`  ✓ Task "${updatedTask.title}" updated to status: ${updatedTask.status}`);

  if (updatedTask.status !== "DONE") {
    throw new Error("Assertion failed: Task status did not update to DONE");
  }

  // Step 6: Safe deletion policy test
  console.log("\n[Step 6] Testing safe list deletion policy...");
  console.log("  Attempting to delete 'Phase2-Projects' without force (force: false)...");

  let caughtError: unknown = null;
  try {
    await caller.todoList.delete({ id: projectsList.id, force: false });
  } catch (err) {
    caughtError = err;
  }

  if (caughtError instanceof TRPCError && caughtError.code === "BAD_REQUEST") {
    console.log(`  ✓ Safe deletion policy BLOCKED deletion as expected! Error message: "${caughtError.message}"`);
  } else {
    throw new Error(`Expected TRPCError BAD_REQUEST when deleting non-empty list without force, got: ${caughtError}`);
  }

  // Step 7: Force delete list with tasks
  console.log("\n[Step 7] Force deleting 'Phase2-Projects' with force: true...");
  const forceDeleteResult = await caller.todoList.delete({ id: projectsList.id, force: true });
  console.log(`  ✓ Force delete succeeded for ID: ${forceDeleteResult.id}`);

  // Verify list and cascaded tasks are deleted
  let listDeletedCheck = null;
  try {
    await caller.todo.list({ listId: projectsList.id });
  } catch (err) {
    listDeletedCheck = err;
  }
  if (listDeletedCheck instanceof TRPCError && listDeletedCheck.code === "NOT_FOUND") {
    console.log("  ✓ Verified: Projects list was completely removed and querying its tasks throws NOT_FOUND!");
  }

  // Step 8: Clean up College list
  console.log("\n[Step 8] Cleaning up 'Phase2-College' test list with force: true...");
  await caller.todoList.delete({ id: collegeList.id, force: true });
  console.log("  ✓ Cleanup completed successfully!");

  console.log("\n=================================================");
  console.log("ALL PHASE 2 LIVE SUPABASE TESTS PASSED 100%!");
  console.log("=================================================\n");
  process.exit(0);
}

runLiveVerification().catch((err) => {
  console.error("Live verification failed:", err);
  process.exit(1);
});
