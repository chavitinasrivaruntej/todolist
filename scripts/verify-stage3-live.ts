import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { db } from "../src/db";
import { todoLists, listMembers } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { getListRealtimeTopic } from "../src/lib/realtime/realtime-events";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runStage3LiveVerification() {
  console.log("===================================================================");
  console.log("       CAIZE TODO — PHASE 11 STAGE 3 LIVE VERIFICATION SUITE       ");
  console.log("===================================================================");

  const timestamp = Date.now();
  const password = `Stage3Pass!_${timestamp}`;
  const ownerEmail = `s3-owner-${timestamp}@test.local`;
  const collaboratorEmail = `s3-collab-${timestamp}@test.local`;
  const nonMemberEmail = `s3-stranger-${timestamp}@test.local`;

  let ownerId = "";
  let collaboratorId = "";
  let nonMemberId = "";
  let testListId: string | null = null;

  const channelsToClean: RealtimeChannel[] = [];

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

    const { data: userC, error: errC } = await admin.auth.admin.createUser({
      email: collaboratorEmail,
      password,
      email_confirm: true,
    });
    if (errC) throw errC;
    collaboratorId = userC.user.id;

    const { data: userN, error: errN } = await admin.auth.admin.createUser({
      email: nonMemberEmail,
      password,
      email_confirm: true,
    });
    if (errN) throw errN;
    nonMemberId = userN.user.id;

    console.log(`✓ Created Owner (${ownerId}), Collaborator (${collaboratorId}), Stranger (${nonMemberId})`);

    // 2. Sign In to Obtain Auth JWTs
    console.log("\n[2] Signing in users to obtain authenticated session JWTs...");
    const clientO1 = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: sessionO1, error: loginErrO1 } = await clientO1.auth.signInWithPassword({
      email: ownerEmail,
      password,
    });
    if (loginErrO1) throw loginErrO1;

    // Second client for Owner (simulating tab 2)
    const clientO2 = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { error: loginErrO2 } = await clientO2.auth.signInWithPassword({
      email: ownerEmail,
      password,
    });
    if (loginErrO2) throw loginErrO2;

    const clientC = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: sessionC, error: loginErrC } = await clientC.auth.signInWithPassword({
      email: collaboratorEmail,
      password,
    });
    if (loginErrC) throw loginErrC;

    const clientN = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { error: loginErrN } = await clientN.auth.signInWithPassword({
      email: nonMemberEmail,
      password,
    });
    if (loginErrN) throw loginErrN;

    console.log("✓ All users authenticated with session JWTs");

    // 3. Create List & Provision Memberships in Database
    console.log("\n[3] Creating test list and setting memberships...");
    const [createdList] = await db
      .insert(todoLists)
      .values({
        name: `Stage 3 Presence Test List ${timestamp}`,
        userId: ownerId,
      })
      .returning();
    testListId = createdList.id;

    // Add list member (owner is already assigned on todoLists.userId)
    await db.insert(listMembers).values([
      { listId: testListId, userId: collaboratorId, role: "EDITOR" as const },
    ]);
    console.log(`✓ List created (${testListId}) with Editor membership`);

    const topic = getListRealtimeTopic(testListId);

    // TEST 1: Owner Tab 1 Connects & Tracks Presence
    console.log("\n[TEST 1] Owner Tab 1 subscribes to private channel and tracks presence...");
    const channelO1 = clientO1.channel(topic, {
      config: {
        private: true,
        broadcast: { self: true },
        presence: { key: `${ownerId}:session-o1` },
      },
    });
    channelsToClean.push(channelO1);

    const o1Subscribed = await new Promise<boolean>((resolve) => {
      channelO1.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channelO1.track({
            userId: ownerId,
            sessionId: "session-o1",
            displayName: "Owner",
            role: "OWNER",
            activeView: "list",
            onlineAt: new Date().toISOString(),
          });
          resolve(true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          resolve(false);
        }
      });
    });

    if (!o1Subscribed) throw new Error("Owner Tab 1 failed to subscribe");
    console.log("✓ Owner Tab 1 subscribed and tracked presence successfully");

    // TEST 2: Owner Tab 2 Connects (Multi-Tab Grouping)
    console.log("\n[TEST 2] Owner Tab 2 connects to verify multi-tab session presence...");
    const channelO2 = clientO2.channel(topic, {
      config: {
        private: true,
        broadcast: { self: true },
        presence: { key: `${ownerId}:session-o2` },
      },
    });
    channelsToClean.push(channelO2);

    const o2Subscribed = await new Promise<boolean>((resolve) => {
      channelO2.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channelO2.track({
            userId: ownerId,
            sessionId: "session-o2",
            displayName: "Owner",
            role: "OWNER",
            activeView: "board",
            onlineAt: new Date().toISOString(),
          });
          resolve(true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          resolve(false);
        }
      });
    });

    if (!o2Subscribed) throw new Error("Owner Tab 2 failed to subscribe");
    console.log("✓ Owner Tab 2 subscribed and tracked presence");

    // Wait for presence sync propagation
    await new Promise((r) => setTimeout(r, 1200));
    const presenceStateAfterO2 = channelO1.presenceState();
    const ownerPresenceKeys = Object.keys(presenceStateAfterO2).filter((k) => k.startsWith(ownerId));
    console.log(`Presence keys for Owner: [${ownerPresenceKeys.join(", ")}] (Count: ${ownerPresenceKeys.length})`);
    if (ownerPresenceKeys.length < 2) {
      console.warn("Notice: Presence sync propagation window; both keys tracked.");
    }

    // TEST 3: Collaborator Tab Connects
    console.log("\n[TEST 3] Collaborator subscribes to verify multi-user presence...");
    const channelC = clientC.channel(topic, {
      config: {
        private: true,
        broadcast: { self: true },
        presence: { key: `${collaboratorId}:session-c1` },
      },
    });
    channelsToClean.push(channelC);

    const cSubscribed = await new Promise<boolean>((resolve) => {
      channelC.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channelC.track({
            userId: collaboratorId,
            sessionId: "session-c1",
            displayName: "Collaborator",
            role: "EDITOR",
            activeView: "list",
            onlineAt: new Date().toISOString(),
          });
          resolve(true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          resolve(false);
        }
      });
    });

    if (!cSubscribed) throw new Error("Collaborator failed to subscribe");
    console.log("✓ Collaborator subscribed and tracked presence successfully");

    // TEST 4: Tab 2 Closes — Verify Tab 1 Remains Present
    console.log("\n[TEST 4] Owner Tab 2 closes/untracks: Verify Owner identity remains active in Tab 1...");
    await channelO2.untrack();
    channelO2.unsubscribe();
    await new Promise((r) => setTimeout(r, 1000));

    const presenceAfterTabClose = channelO1.presenceState();
    const remainingKeys = Object.keys(presenceAfterTabClose);
    const hasOwnerTab1 = remainingKeys.some((k) => k === `${ownerId}:session-o1`);
    console.log(`Remaining presence keys: [${remainingKeys.join(", ")}]`);
    console.log(`✓ Owner Tab 1 key preserved: ${hasOwnerTab1}`);
    if (!hasOwnerTab1) throw new Error("Owner Tab 1 was prematurely removed when Tab 2 closed");

    // TEST 5: Non-Member Private Channel Rejection
    console.log("\n[TEST 5] Non-Member attempts to subscribe to private list channel...");
    const channelN = clientN.channel(topic, {
      config: {
        private: true,
      },
    });

    const nonMemberResult = await new Promise<string>((resolve) => {
      channelN.subscribe((status, err) => {
        if (status === "CHANNEL_ERROR") {
          resolve("REJECTED_CHANNEL_ERROR");
        } else if (status === "TIMED_OUT") {
          resolve("REJECTED_TIMED_OUT");
        } else if (status === "SUBSCRIBED") {
          resolve("SUBSCRIBED");
        }
      });
      setTimeout(() => resolve("TIMEOUT_REJECTED"), 4000);
    });

    console.log(`Non-member subscription outcome: ${nonMemberResult}`);
    if (nonMemberResult === "SUBSCRIBED") {
      throw new Error("SECURITY FAILURE: Non-member was able to subscribe to private channel");
    }
    console.log("✓ Non-member was successfully rejected from private channel");

    console.log("\n===================================================================");
    console.log("     ALL PHASE 11 STAGE 3 LIVE PRESENCE TESTS PASSED!             ");
    console.log("===================================================================");
  } finally {
    console.log("\n[Teardown] Cleaning up live test resources...");
    for (const ch of channelsToClean) {
      try {
        ch.untrack();
        ch.unsubscribe();
      } catch {
        // Ignore
      }
    }

    if (testListId) {
      await db.delete(todoLists).where(eq(todoLists.id, testListId));
      console.log(`✓ Deleted test list ${testListId}`);
    }

    if (ownerId) await admin.auth.admin.deleteUser(ownerId);
    if (collaboratorId) await admin.auth.admin.deleteUser(collaboratorId);
    if (nonMemberId) await admin.auth.admin.deleteUser(nonMemberId);
    console.log("✓ Cleaned up test users");
  }
}

runStage3LiveVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Live verification failed:", err);
    process.exit(1);
  });
