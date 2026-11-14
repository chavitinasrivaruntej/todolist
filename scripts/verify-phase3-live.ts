import { appRouter } from "../src/server/api/root";

async function runPhase3LiveVerification() {
  console.log("=================================================");
  console.log("Phase 3 Live Supabase Dual-View & Kanban Suite");
  console.log("=================================================");

  const caller = appRouter.createCaller({
    headers: undefined,
  });

  // Step 1: Query existing lists
  console.log("\n[Step 1] Querying lists...");
  const lists = await caller.todoList.list();
  console.log(`  Found ${lists.length} list(s).`);

  const personalList = lists.find((l) => l.name === "Personal");
  if (!personalList) {
    throw new Error("Default 'Personal' list was not found.");
  }
  console.log(`  ✓ Personal List ID: ${personalList.id}`);

  // Step 2: Create a dedicated Phase 3 test list
  console.log("\n[Step 2] Creating 'Phase3-Board-Test' list...");
  const testList = await caller.todoList.create({ name: "Phase3-Board-Test" });
  console.log(`  ✓ Created list with ID: ${testList.id}`);

  // Step 3: Populate all 3 Kanban columns
  console.log("\n[Step 3] Populating tasks for each Kanban column...");
  const taskTodo = await caller.todo.create({
    listId: testList.id,
    title: "Kanban Task in To Do",
    description: "Initial status TODO",
    status: "TODO",
  });
  console.log(`  ✓ Created TODO task (ID: ${taskTodo.id})`);

  const taskProgress = await caller.todo.create({
    listId: testList.id,
    title: "Kanban Task in Progress",
    description: "Initial status IN_PROGRESS",
    status: "IN_PROGRESS",
  });
  console.log(`  ✓ Created IN_PROGRESS task (ID: ${taskProgress.id})`);

  const taskDone = await caller.todo.create({
    listId: testList.id,
    title: "Kanban Task Done",
    description: "Initial status DONE",
    status: "DONE",
  });
  console.log(`  ✓ Created DONE task (ID: ${taskDone.id})`);

  // Step 4: Verify Kanban column partitioning
  console.log("\n[Step 4] Querying and partitioning tasks across columns...");
  const allTasks = await caller.todo.list({ listId: testList.id });
  const todoCol = allTasks.filter((t) => t.status === "TODO");
  const progressCol = allTasks.filter((t) => t.status === "IN_PROGRESS");
  const doneCol = allTasks.filter((t) => t.status === "DONE");

  console.log(`  To Do Column count: ${todoCol.length}`);
  console.log(`  In Progress Column count: ${progressCol.length}`);
  console.log(`  Done Column count: ${doneCol.length}`);

  if (todoCol.length !== 1 || todoCol[0]?.id !== taskTodo.id) {
    throw new Error("Assertion failed: To Do column should contain exactly taskTodo");
  }
  if (progressCol.length !== 1 || progressCol[0]?.id !== taskProgress.id) {
    throw new Error("Assertion failed: In Progress column should contain exactly taskProgress");
  }
  if (doneCol.length !== 1 || doneCol[0]?.id !== taskDone.id) {
    throw new Error("Assertion failed: Done column should contain exactly taskDone");
  }
  console.log("  ✓ Correct 3-column partitioning verified!");

  // Step 5: Test Status Transitions (Board actions)
  console.log("\n[Step 5] Executing status transitions...");
  
  // Transition 1: TODO -> IN_PROGRESS
  const movedToProgress = await caller.todo.updateStatus({
    id: taskTodo.id,
    status: "IN_PROGRESS",
  });
  if (movedToProgress.status !== "IN_PROGRESS") {
    throw new Error("Assertion failed: taskTodo did not transition to IN_PROGRESS");
  }
  console.log(`  ✓ Transition 1 (TODO -> IN_PROGRESS) verified: "${movedToProgress.title}"`);

  // Transition 2: IN_PROGRESS -> DONE
  const movedToDone = await caller.todo.updateStatus({
    id: taskProgress.id,
    status: "DONE",
  });
  if (movedToDone.status !== "DONE") {
    throw new Error("Assertion failed: taskProgress did not transition to DONE");
  }
  console.log(`  ✓ Transition 2 (IN_PROGRESS -> DONE) verified: "${movedToDone.title}"`);

  // Transition 3: DONE -> TODO (Reopening)
  const reopenedToTodo = await caller.todo.updateStatus({
    id: taskDone.id,
    status: "TODO",
  });
  if (reopenedToTodo.status !== "TODO") {
    throw new Error("Assertion failed: taskDone did not reopen to TODO");
  }
  console.log(`  ✓ Transition 3 (DONE -> TODO reopen) verified: "${reopenedToTodo.title}"`);

  // Step 6: Verify Persistence across refetch
  console.log("\n[Step 6] Verifying persistence of transitioned statuses from database...");
  const refetchedTasks = await caller.todo.list({ listId: testList.id });
  const refetchedTodoCol = refetchedTasks.filter((t) => t.status === "TODO");
  const refetchedProgressCol = refetchedTasks.filter((t) => t.status === "IN_PROGRESS");
  const refetchedDoneCol = refetchedTasks.filter((t) => t.status === "DONE");

  if (refetchedTodoCol.length !== 1 || refetchedTodoCol[0]?.id !== taskDone.id) {
    throw new Error("Assertion failed: Reopened task is not in To Do column");
  }
  if (refetchedProgressCol.length !== 1 || refetchedProgressCol[0]?.id !== taskTodo.id) {
    throw new Error("Assertion failed: Moved task is not in In Progress column");
  }
  if (refetchedDoneCol.length !== 1 || refetchedDoneCol[0]?.id !== taskProgress.id) {
    throw new Error("Assertion failed: Completed task is not in Done column");
  }
  console.log("  ✓ Database persistence verified for all transitions!");

  // Step 7: Clean up test list
  console.log("\n[Step 7] Cleaning up test list 'Phase3-Board-Test' with force: true...");
  await caller.todoList.delete({ id: testList.id, force: true });
  console.log("  ✓ Test fixtures cleaned up successfully!");

  console.log("\n=================================================");
  console.log("ALL PHASE 3 DUAL-VIEW & KANBAN TESTS PASSED 100%!");
  console.log("=================================================\n");
  process.exit(0);
}

runPhase3LiveVerification().catch((err) => {
  console.error("Phase 3 Live verification failed:", err);
  process.exit(1);
});
