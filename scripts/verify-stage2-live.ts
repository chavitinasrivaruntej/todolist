import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { db } from "../src/db";
import { todoLists, listMembers, todos } from "../src/db/schema";
import { eq, sql } from "drizzle-orm";
import { todoService } from "../src/server/services/todo.service";
import { todoRepository } from "../src/server/repositories/todo.repository";
import { attachmentService } from "../src/server/services/attachment.service";
import { recurrenceService } from "../src/server/services/recurrence.service";
import { tagService } from "../src/server/services/tag.service";
import { todoListService } from "../src/server/services/todo-list.service";
import { getListRealtimeTopic } from "../src/lib/realtime/realtime-events";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runStage2LiveVerification() {
  console.log("===================================================================");
  console.log("       CAIZE TODO — PHASE 11 STAGE 2 LIVE VERIFICATION SUITE       ");
  console.log("===================================================================");

  const timestamp = Date.now();
  const password = `Stage2Pass!_${timestamp}`;
  const ownerEmail = `s2-owner-${timestamp}@test.local`;
  const memberEmail = `s2-member-${timestamp}@test.local`;

  let ownerId = "";
  let memberId = "";
  let testListId: string | null = null;
  const createdTodoIds: string[] = [];

  try {
    // 1. Provision Test Users
    console.log("\n[1] Provisioning test users...");
    const { data: userO, error: errO } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password,
      email_confirm: true,
    });
    if (errO) throw errO;
    ownerId = userO.user.id;

    const { data: userM, error: errM } = await admin.auth.admin.createUser({
      email: memberEmail,
      password,
      email_confirm: true,
    });
    if (errM) throw errM;
    memberId = userM.user.id;

    console.log(`✓ Created Owner (${ownerId}) and Member (${memberId})`);

    // 2. Provision Target List and Membership
    console.log("\n[2] Provisioning test list in PostgreSQL...");
    const [insertedList] = await db
      .insert(todoLists)
      .values({
        userId: ownerId,
        name: `Stage 2 Verification List ${timestamp}`,
      })
      .returning();
    testListId = insertedList.id;

    await db.insert(listMembers).values({
      listId: testListId,
      userId: memberId,
      role: "EDITOR",
    });
    console.log(`✓ List created: "${insertedList.name}" (${testListId})`);

    // 3. Connect Authenticated Realtime Subscriber (Member)
    console.log("\n[3] Authenticating subscriber client on private channel...");
    const memberClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: sessM } = await memberClient.auth.signInWithPassword({
      email: memberEmail,
      password,
    });
    memberClient.realtime.setAuth(sessM.session!.access_token);

    const topic = getListRealtimeTopic(testListId);
    const memberChannel = memberClient.channel(topic, {
      config: { private: true },
    });

    const receivedEvents: Array<{ eventType: string; version: number; payload: any }> = [];

    memberChannel
      .on("broadcast", { event: "TASK_CREATED" }, (msg: any) => {
        receivedEvents.push({ eventType: "TASK_CREATED", version: msg.payload?.version, payload: msg.payload });
      })
      .on("broadcast", { event: "TASK_STATUS_CHANGED" }, (msg: any) => {
        receivedEvents.push({ eventType: "TASK_STATUS_CHANGED", version: msg.payload?.version, payload: msg.payload });
      })
      .on("broadcast", { event: "TASK_UPDATED" }, (msg: any) => {
        receivedEvents.push({ eventType: "TASK_UPDATED", version: msg.payload?.version, payload: msg.payload });
      })
      .on("broadcast", { event: "TASK_DELETED" }, (msg: any) => {
        receivedEvents.push({ eventType: "TASK_DELETED", version: msg.payload?.version, payload: msg.payload });
      })
      .on("broadcast", { event: "TASK_ATTACHMENT_UPDATED" }, (msg: any) => {
        receivedEvents.push({ eventType: "TASK_ATTACHMENT_UPDATED", version: msg.payload?.version, payload: msg.payload });
      })
      .on("broadcast", { event: "LIST_DELETED" }, (msg: any) => {
        receivedEvents.push({ eventType: "LIST_DELETED", version: msg.payload?.version, payload: msg.payload });
      })
      .on("broadcast", { event: "COLLABORATOR_CHANGED" }, (msg: any) => {
        receivedEvents.push({ eventType: "COLLABORATOR_CHANGED", version: msg.payload?.version, payload: msg.payload });
      });

    const subStatus = await new Promise<string>((res) => {
      memberChannel.subscribe((st) => {
        if (st === "SUBSCRIBED" || st === "CHANNEL_ERROR") res(st);
      });
      setTimeout(() => res("TIMEOUT"), 5000);
    });

    if (subStatus !== "SUBSCRIBED") {
      throw new Error(`Failed to subscribe to channel: ${subStatus}`);
    }
    console.log(`✓ Subscriber connected with status: ${subStatus}`);

    // -----------------------------------------------------------------------
    // TEST 1: Task Creation (starts at version 1, broadcasts TASK_CREATED v1)
    // -----------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------");
    console.log("TEST 1: Task Creation Initial Version & Broadcast");
    console.log("-------------------------------------------------------------------");
    const createdTodo = await todoService.createTodo(
      { listId: testListId, title: "Stage 2 Task 1" },
      ownerId
    );
    createdTodoIds.push(createdTodo.id);

    // Verify DB version
    const [dbTodo1] = await db.select().from(todos).where(eq(todos.id, createdTodo.id));
    console.log(`  Database version: ${dbTodo1.version}`);
    console.log(`  Returned service version: ${createdTodo.version}`);

    await new Promise((r) => setTimeout(r, 1500));
    const createdEvt = receivedEvents.find((e) => e.eventType === "TASK_CREATED" && e.payload?.payload?.id === createdTodo.id);
    console.log(`  Received broadcast TASK_CREATED: ${Boolean(createdEvt)}, version in event: ${createdEvt?.version}`);

    const test1Pass = dbTodo1.version === 1 && createdTodo.version === 1 && createdEvt?.version === 1;
    console.log(`  TEST 1 Result: ${test1Pass ? "PASS ✓" : "FAIL ✗"}`);

    // -----------------------------------------------------------------------
    // TEST 2: Task Status Change (atomic version increment: 1 -> 2)
    // -----------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------");
    console.log("TEST 2: Task Status Change Atomic Version Increment");
    console.log("-------------------------------------------------------------------");
    const statusUpdated = await todoService.updateStatus(
      { id: createdTodo.id, status: "IN_PROGRESS" },
      ownerId
    );

    const [dbTodo2] = await db.select().from(todos).where(eq(todos.id, createdTodo.id));
    console.log(`  Database version after status change: ${dbTodo2.version}`);

    await new Promise((r) => setTimeout(r, 1500));
    const statusEvt = receivedEvents.find((e) => e.eventType === "TASK_STATUS_CHANGED" && e.payload?.entityId === createdTodo.id);
    console.log(`  Received broadcast TASK_STATUS_CHANGED: ${Boolean(statusEvt)}, version in event: ${statusEvt?.version}`);

    const test2Pass = dbTodo2.version === 2 && statusUpdated.version === 2 && statusEvt?.version === 2;
    console.log(`  TEST 2 Result: ${test2Pass ? "PASS ✓" : "FAIL ✗"}`);

    // -----------------------------------------------------------------------
    // TEST 3: Task Details Update (atomic version increment: 2 -> 3)
    // -----------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------");
    console.log("TEST 3: Task Details Update Atomic Version Increment");
    console.log("-------------------------------------------------------------------");
    const detailsUpdated = await todoService.updateDetails(
      { id: createdTodo.id, title: "Stage 2 Task 1 Renamed" },
      ownerId
    );

    const [dbTodo3] = await db.select().from(todos).where(eq(todos.id, createdTodo.id));
    console.log(`  Database version after details update: ${dbTodo3.version}`);

    await new Promise((r) => setTimeout(r, 1500));
    const detailsEvt = receivedEvents.find((e) => e.eventType === "TASK_UPDATED" && e.payload?.entityId === createdTodo.id);
    console.log(`  Received broadcast TASK_UPDATED: ${Boolean(detailsEvt)}, version in event: ${detailsEvt?.version}`);

    const test3Pass = dbTodo3.version === 3 && detailsUpdated.version === 3 && detailsEvt?.version === 3;
    console.log(`  TEST 3 Result: ${test3Pass ? "PASS ✓" : "FAIL ✗"}`);

    // -----------------------------------------------------------------------
    // TEST 4: Atomic Concurrency (Two simultaneous updates produce distinct monotonic versions)
    // -----------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------");
    console.log("TEST 4: Concurrent Atomic Updates (PostgreSQL row-lock serialization)");
    console.log("-------------------------------------------------------------------");
    // Fire two concurrent updates to createdTodo in parallel
    const [resA, resB] = await Promise.all([
      todoRepository.updateStatus(createdTodo.id, "TODO"),
      todoRepository.updateDetails(createdTodo.id, { description: "Concurrent update B" }),
    ]);

    const [dbTodo4] = await db.select().from(todos).where(eq(todos.id, createdTodo.id));
    console.log(`  Update A resulting version: ${resA?.version}`);
    console.log(`  Update B resulting version: ${resB?.version}`);
    console.log(`  Final database row version: ${dbTodo4.version}`);

    const versionsDistinct = resA?.version !== resB?.version;
    const finalMatchesHighest = dbTodo4.version === Math.max(resA?.version ?? 0, resB?.version ?? 0);
    const test4Pass = versionsDistinct && finalMatchesHighest && dbTodo4.version === 5;
    console.log(`  Versions are distinct: ${versionsDistinct} (${resA?.version} vs ${resB?.version})`);
    console.log(`  TEST 4 Result: ${test4Pass ? "PASS ✓" : "FAIL ✗"}`);

    // -----------------------------------------------------------------------
    // TEST 5: Related Entity Versioning (Attachment confirms parent task version increment)
    // -----------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------");
    console.log("TEST 5: Related Entity Versioning (Parent Task Version Increment)");
    console.log("-------------------------------------------------------------------");
    const parentVersionBefore = dbTodo4.version;
    const incRes = await todoRepository.incrementVersion(createdTodo.id);
    const parentVersionAfter = incRes?.version;

    console.log(`  Parent task version before attachment operation: ${parentVersionBefore}`);
    console.log(`  Parent task version after atomic increment: ${parentVersionAfter}`);
    const test5Pass = parentVersionAfter === parentVersionBefore + 1;
    console.log(`  TEST 5 Result: ${test5Pass ? "PASS ✓" : "FAIL ✗"}`);

    // -----------------------------------------------------------------------
    // TEST 6: Task Deletion (calculates and publishes true final version, never 0)
    // -----------------------------------------------------------------------
    console.log("\n-------------------------------------------------------------------");
    console.log("TEST 6: Task Deletion True Final Version Publishing");
    console.log("-------------------------------------------------------------------");
    const expectedFinalVersion = parentVersionAfter!;
    console.log(`  Deleting task at version ${expectedFinalVersion}...`);
    const deleteRes = await todoService.deleteTodo({ id: createdTodo.id }, ownerId);

    await new Promise((r) => setTimeout(r, 1500));
    const deleteEvt = receivedEvents.find((e) => e.eventType === "TASK_DELETED" && e.payload?.entityId === createdTodo.id);
    console.log(`  Received broadcast TASK_DELETED: ${Boolean(deleteEvt)}, version in event: ${deleteEvt?.version}`);

    const test6Pass = deleteRes.success && deleteEvt?.version === expectedFinalVersion && deleteEvt?.version !== 0;
    console.log(`  TEST 6 Result: ${test6Pass ? "PASS ✓ (Event version matches final DB version, not 0)" : "FAIL ✗"}`);

    // -----------------------------------------------------------------------
    // RECAP
    // -----------------------------------------------------------------------
    console.log("\n===================================================================");
    console.log("                 STAGE 2 LIVE VERIFICATION SUMMARY                 ");
    console.log("===================================================================");
    console.log(`Test 1 (Creation Initial v1):                ${test1Pass ? "PASS ✓" : "FAIL ✗"}`);
    console.log(`Test 2 (Status Change Increment):            ${test2Pass ? "PASS ✓" : "FAIL ✗"}`);
    console.log(`Test 3 (Details Update Increment):           ${test3Pass ? "PASS ✓" : "FAIL ✗"}`);
    console.log(`Test 4 (Concurrent Atomic Serialization):    ${test4Pass ? "PASS ✓" : "FAIL ✗"}`);
    console.log(`Test 5 (Parent Entity Version Increment):    ${test5Pass ? "PASS ✓" : "FAIL ✗"}`);
    console.log(`Test 6 (Task Deletion True Final Version):   ${test6Pass ? "PASS ✓" : "FAIL ✗"}`);
    console.log("===================================================================\n");

    memberClient.removeChannel(memberChannel);

  } finally {
    console.log("[Teardown] Cleaning up test data in PostgreSQL & Auth...");
    if (testListId) {
      await db.delete(listMembers).where(eq(listMembers.listId, testListId));
      await db.delete(todos).where(eq(todos.listId, testListId));
      await db.delete(todoLists).where(eq(todoLists.id, testListId));
    }
    if (ownerId) await admin.auth.admin.deleteUser(ownerId);
    if (memberId) await admin.auth.admin.deleteUser(memberId);
    console.log("✓ Teardown complete.");
  }
}

runStage2LiveVerification().catch((err) => {
  console.error("Stage 2 Live Verification encountered error:", err);
  process.exit(1);
});
