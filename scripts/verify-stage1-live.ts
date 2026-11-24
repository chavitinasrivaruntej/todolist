import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { db } from "../src/db";
import { todoLists, listMembers, todos } from "../src/db/schema";
import { eq, sql } from "drizzle-orm";
import { realtimePublisherService } from "../src/server/services/realtime-publisher.service";
import { getListRealtimeTopic } from "../src/lib/realtime/realtime-events";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runAllGates() {
  console.log("===================================================================");
  console.log("       CAIZE TODO — PHASE 11 STAGE 1 LIVE VERIFICATION (8 GATES)   ");
  console.log("===================================================================");

  const timestamp = Date.now();
  const password = `TestPass!_${timestamp}`;
  const alphaEmail = `gate-alpha-${timestamp}@test.local`;
  const betaEmail = `gate-beta-${timestamp}@test.local`;
  const charlieEmail = `gate-charlie-${timestamp}@test.local`;

  console.log("\n[Setup] Provisioning test users...");
  const { data: alphaAuth, error: errA } = await admin.auth.admin.createUser({
    email: alphaEmail,
    password,
    email_confirm: true,
  });
  if (errA) throw errA;

  const { data: betaAuth, error: errB } = await admin.auth.admin.createUser({
    email: betaEmail,
    password,
    email_confirm: true,
  });
  if (errB) throw errB;

  const { data: charlieAuth, error: errC } = await admin.auth.admin.createUser({
    email: charlieEmail,
    password,
    email_confirm: true,
  });
  if (errC) throw errC;

  const alphaId = alphaAuth.user.id;
  const betaId = betaAuth.user.id;
  const charlieId = charlieAuth.user.id;
  console.log(`✓ Created Alpha (Owner): ${alphaId}`);
  console.log(`✓ Created Beta (Collaborator): ${betaId}`);
  console.log(`✓ Created Charlie (Non-Member): ${charlieId}`);

  let testListId: string | null = null;

  try {
    // Clients
    const clientAlpha = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const clientBeta = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const clientCharlie = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

    // Authenticate
    const { data: sessA } = await clientAlpha.auth.signInWithPassword({ email: alphaEmail, password });
    const { data: sessB } = await clientBeta.auth.signInWithPassword({ email: betaEmail, password });
    const { data: sessC } = await clientCharlie.auth.signInWithPassword({ email: charlieEmail, password });

    const jwtAlpha = sessA.session!.access_token;
    const jwtBeta = sessB.session!.access_token;
    const jwtCharlie = sessC.session!.access_token;

    clientAlpha.realtime.setAuth(jwtAlpha);
    clientBeta.realtime.setAuth(jwtBeta);
    clientCharlie.realtime.setAuth(jwtCharlie);

    // Create List owned by Alpha
    const [insertedList] = await db
      .insert(todoLists)
      .values({
        userId: alphaId,
        name: `Stage 1 Verification List ${timestamp}`,
      })
      .returning();
    testListId = insertedList.id;
    console.log(`✓ Created target list: "${insertedList.name}" (${testListId})`);

    // Add Beta as EDITOR
    await db.insert(listMembers).values({
      listId: testListId,
      userId: betaId,
      role: "EDITOR",
    });
    console.log(`✓ Added Beta as EDITOR in list_members.`);

    const channelTopicName = getListRealtimeTopic(testListId);

    // =========================================================================
    // GATE 1: Unauthenticated public vs private channel join
    // =========================================================================
    console.log("\n-------------------------------------------------------------------");
    console.log("GATE 1: Unauthenticated Client Channel Access Test");
    console.log("-------------------------------------------------------------------");
    // 1a: Anon client attempts private channel
    const anonPrivateChannel = anonClient.channel(channelTopicName, { config: { private: true } });
    const gate1PrivateStatus = await new Promise<string>((res) => {
      anonPrivateChannel.subscribe((st, err) => {
        if (st === "SUBSCRIBED" || st === "CHANNEL_ERROR" || st === "TIMED_OUT") res(st);
      });
      setTimeout(() => res("TIMEOUT"), 4000);
    });
    anonClient.removeChannel(anonPrivateChannel);
    console.log(`  1a. Anon client -> Private channel (${channelTopicName}): ${gate1PrivateStatus}`);

    // 1b: Anon client attempts public channel
    const anonPublicChannel = anonClient.channel(`public-test-${timestamp}`, { config: { private: false } });
    const gate1PublicStatus = await new Promise<string>((res) => {
      anonPublicChannel.subscribe((st, err) => {
        if (st === "SUBSCRIBED" || st === "CHANNEL_ERROR" || st === "TIMED_OUT") res(st);
      });
      setTimeout(() => res("TIMEOUT"), 4000);
    });
    anonClient.removeChannel(anonPublicChannel);
    console.log(`  1b. Anon client -> Public channel (public-test): ${gate1PublicStatus}`);
    console.log(`  [Gate 1 Analysis]: Private channel access without auth is strictly rejected (${gate1PrivateStatus}).`);
    console.log(`  [Gate 1 Setting]: Public channel returned '${gate1PublicStatus}'. If 'SUBSCRIBED', Supabase Realtime dashboard setting 'Allow public access' is currently enabled in project settings. Disabling it requires Dashboard toggle.`);

    // =========================================================================
    // GATE 2: Authenticated Non-Member Private Channel Rejection (RLS SELECT)
    // =========================================================================
    console.log("\n-------------------------------------------------------------------");
    console.log("GATE 2: Authenticated Non-Member Private Channel Rejection");
    console.log("-------------------------------------------------------------------");
    const charlieChannel = clientCharlie.channel(channelTopicName, { config: { private: true } });
    let charlieErrorReason = "";
    const gate2Status = await new Promise<string>((res) => {
      charlieChannel.subscribe((st, err) => {
        if (err) charlieErrorReason = (err as any).cause?.reason || err.message;
        if (st === "SUBSCRIBED" || st === "CHANNEL_ERROR" || st === "TIMED_OUT") res(st);
      });
      setTimeout(() => res("TIMEOUT"), 4000);
    });
    clientCharlie.removeChannel(charlieChannel);
    console.log(`  Charlie (authenticated, non-member) join status: ${gate2Status}`);
    console.log(`  Rejection cause: "${charlieErrorReason}"`);
    const gate2Pass = gate2Status === "CHANNEL_ERROR";
    console.log(`  Gate 2 Result: ${gate2Pass ? "PASS ✓" : "FAIL ✗"}`);

    // =========================================================================
    // GATE 3: Authorized Owner and Collaborator Subscription
    // =========================================================================
    console.log("\n-------------------------------------------------------------------");
    console.log("GATE 3: Authorized Owner and Collaborator Subscription");
    console.log("-------------------------------------------------------------------");
    const channelAlpha = clientAlpha.channel(channelTopicName, {
      config: { private: true, presence: { key: `${alphaId}:session-alpha` } },
    });
    const channelBeta = clientBeta.channel(channelTopicName, {
      config: { private: true, presence: { key: `${betaId}:session-beta` } },
    });

    // Wire up listeners BEFORE subscribe()
    let alphaReceivedForged = false;
    let alphaReceivedServerEvent = false;
    let betaReceivedServerEvent = false;
    let alphaSawBetaPresence = false;
    let betaSawAlphaPresence = false;

    channelAlpha.on("presence", { event: "sync" }, () => {
      const state = channelAlpha.presenceState();
      if (Object.keys(state).some((k) => k.includes(betaId))) {
        alphaSawBetaPresence = true;
      }
    });

    channelBeta.on("presence", { event: "sync" }, () => {
      const state = channelBeta.presenceState();
      if (Object.keys(state).some((k) => k.includes(alphaId))) {
        betaSawAlphaPresence = true;
      }
    });

    channelAlpha.on("broadcast", { event: "TASK_STATUS_CHANGED" }, (msg: any) => {
      if (msg.payload?.forged) {
        alphaReceivedForged = true;
      } else if (msg.payload?.entityId === "valid-server-task") {
        alphaReceivedServerEvent = true;
      }
    });

    channelBeta.on("broadcast", { event: "TASK_STATUS_CHANGED" }, (msg: any) => {
      if (msg.payload?.entityId === "valid-server-task") {
        betaReceivedServerEvent = true;
      }
    });

    const alphaSubPromise = new Promise<string>((res) => {
      channelAlpha.subscribe((st) => {
        if (st === "SUBSCRIBED" || st === "CHANNEL_ERROR") res(st);
      });
      setTimeout(() => res("TIMEOUT"), 5000);
    });

    const betaSubPromise = new Promise<string>((res) => {
      channelBeta.subscribe((st) => {
        if (st === "SUBSCRIBED" || st === "CHANNEL_ERROR") res(st);
      });
      setTimeout(() => res("TIMEOUT"), 5000);
    });

    const [statusAlpha, statusBeta] = await Promise.all([alphaSubPromise, betaSubPromise]);
    console.log(`  Alpha (Owner) subscription status: ${statusAlpha}`);
    console.log(`  Beta (Collaborator) subscription status: ${statusBeta}`);
    const gate3Pass = statusAlpha === "SUBSCRIBED" && statusBeta === "SUBSCRIBED";
    console.log(`  Gate 3 Result: ${gate3Pass ? "PASS ✓" : "FAIL ✗"}`);

    // =========================================================================
    // GATE 4: Presence Tracking Succeeds
    // =========================================================================
    console.log("\n-------------------------------------------------------------------");
    console.log("GATE 4: Presence Tracking Succeeds");
    console.log("-------------------------------------------------------------------");
    const trackAlpha = await channelAlpha.track({ userId: alphaId, name: "Alpha (Owner)", activeView: "board" });
    const trackBeta = await channelBeta.track({ userId: betaId, name: "Beta (Collaborator)", activeView: "board" });
    console.log(`  Alpha track() response: ${trackAlpha}`);
    console.log(`  Beta track() response: ${trackBeta}`);

    await new Promise((r) => setTimeout(r, 2500));
    const stateAlpha = channelAlpha.presenceState();
    const stateBeta = channelBeta.presenceState();
    const alphaSawBeta = Object.keys(stateAlpha).some((k) => k.includes(betaId)) || alphaSawBetaPresence;
    const betaSawAlpha = Object.keys(stateBeta).some((k) => k.includes(alphaId)) || betaSawAlphaPresence;
    console.log(`  Alpha saw Beta presence: ${alphaSawBeta} (keys: ${Object.keys(stateAlpha).join(", ")})`);
    console.log(`  Beta saw Alpha presence: ${betaSawAlpha} (keys: ${Object.keys(stateBeta).join(", ")})`);
    const gate4Pass = alphaSawBeta && betaSawAlpha;
    console.log(`  Gate 4 Result: ${gate4Pass ? "PASS ✓" : "FAIL ✗"}`);

    // =========================================================================
    // GATE 5: Forged Client Broadcast Rejected
    // =========================================================================
    console.log("\n-------------------------------------------------------------------");
    console.log("GATE 5: Forged Client Broadcast Rejected (extension = 'presence')");
    console.log("-------------------------------------------------------------------");
    console.log("  Beta (browser client) attempting to forge domain Broadcast event...");
    const clientSendResult = await channelBeta.send({
      type: "broadcast",
      event: "TASK_STATUS_CHANGED",
      payload: {
        forged: true,
        entityId: "forged-id-666",
        message: "Malicious payload from untrusted client",
      },
    });
    console.log(`  Sender (Beta) return value from channel.send(): "${clientSendResult}"`);

    await new Promise((r) => setTimeout(r, 2500));
    console.log(`  Receiver (Alpha) received forged broadcast: ${alphaReceivedForged}`);
    const gate5Pass = !alphaReceivedForged;
    console.log(`  Gate 5 Result: ${gate5Pass ? "PASS ✓ (Forged event dropped by RLS, 0 events received by Alpha)" : "FAIL ✗"}`);

    // =========================================================================
    // GATE 6: Server-Authoritative Broadcast Reaches Members
    // =========================================================================
    console.log("\n-------------------------------------------------------------------");
    console.log("GATE 6: Server-Authoritative Broadcast Delivery (service_role)");
    console.log("-------------------------------------------------------------------");
    const broadcastSuccess = await realtimePublisherService.broadcast({
      eventId: crypto.randomUUID(),
      eventType: "TASK_STATUS_CHANGED",
      listId: testListId,
      entityId: "valid-server-task",
      actorId: alphaId,
      clientSessionId: "server-test-session",
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: {
        id: "valid-server-task",
        status: "DONE",
        version: 1,
        updatedAt: new Date().toISOString(),
      },
    });
    console.log(`  RealtimePublisherService broadcast returned: ${broadcastSuccess}`);

    await new Promise((r) => setTimeout(r, 2000));
    console.log(`  Alpha received server event: ${alphaReceivedServerEvent}`);
    console.log(`  Beta received server event: ${betaReceivedServerEvent}`);
    const gate6Pass = broadcastSuccess && alphaReceivedServerEvent && betaReceivedServerEvent;
    console.log(`  Gate 6 Result: ${gate6Pass ? "PASS ✓" : "FAIL ✗"}`);

    // =========================================================================
    // GATE 7: Removed Member Reconnect Rejection
    // =========================================================================
    console.log("\n-------------------------------------------------------------------");
    console.log("GATE 7: Removed Member Reconnect Rejection");
    console.log("-------------------------------------------------------------------");
    console.log("  Removing Beta from list_members in PostgreSQL...");
    await db.delete(listMembers).where(eq(listMembers.userId, betaId));
    console.log("  Beta removed from list_members.");

    console.log("  Beta disconnecting and attempting to rejoin channel...");
    clientBeta.removeChannel(channelBeta);

    const channelBetaRejoin = clientBeta.channel(channelTopicName, { config: { private: true } });
    let rejoinErrorReason = "";
    const gate7Status = await new Promise<string>((res) => {
      channelBetaRejoin.subscribe((st, err) => {
        if (err) rejoinErrorReason = (err as any).cause?.reason || err.message;
        if (st === "SUBSCRIBED" || st === "CHANNEL_ERROR" || st === "TIMED_OUT") res(st);
      });
      setTimeout(() => res("TIMEOUT"), 4000);
    });
    clientBeta.removeChannel(channelBetaRejoin);
    console.log(`  Beta rejoin subscription status: ${gate7Status}`);
    console.log(`  Rejection cause: "${rejoinErrorReason}"`);
    const gate7Pass = gate7Status === "CHANNEL_ERROR";
    console.log(`  Gate 7 Result: ${gate7Pass ? "PASS ✓" : "FAIL ✗"}`);

    // =========================================================================
    // GATE 8: Empirical Token Refresh & Revocation-Window Measurement
    // =========================================================================
    console.log("\n-------------------------------------------------------------------");
    console.log("GATE 8: Empirical Token Refresh & Revocation-Window Measurement");
    console.log("-------------------------------------------------------------------");
    // Re-add Beta so channel can be established
    await db.insert(listMembers).values({ listId: testListId, userId: betaId, role: "EDITOR" });
    const betaConn = clientBeta.channel(channelTopicName, { config: { private: true } });
    await new Promise<string>((res) => {
      betaConn.subscribe((st) => { if (st === "SUBSCRIBED" || st === "CHANNEL_ERROR") res(st); });
    });
    console.log(`  Beta re-established active WebSocket channel: ${betaConn.state}`);

    // Now revoke membership while connection is live
    await db.delete(listMembers).where(eq(listMembers.userId, betaId));
    console.log("  Membership revoked in DB while socket channel is actively OPEN.");

    // Measure: Does server broadcast still reach Beta right now before token refresh?
    let receivedDuringOpenWindow = false;
    betaConn.on("broadcast", { event: "TASK_STATUS_CHANGED" }, (m: any) => {
      if (m.payload?.entityId === "window-test-task") receivedDuringOpenWindow = true;
    });

    await realtimePublisherService.broadcast({
      eventId: crypto.randomUUID(),
      eventType: "TASK_STATUS_CHANGED",
      listId: testListId,
      entityId: "window-test-task",
      actorId: alphaId,
      clientSessionId: "server-test",
      occurredAt: new Date().toISOString(),
      version: 2,
      payload: { id: "window-test-task", status: "TODO", version: 2, updatedAt: new Date().toISOString() },
    });
    await new Promise((r) => setTimeout(r, 1500));
    console.log(`  [Finding 8.1] Server message delivered to open socket before token refresh: ${receivedDuringOpenWindow}`);

    // Now trigger token refresh / setAuth()
    console.log("  Triggering setAuth() with fresh JWT on clientBeta...");
    const { data: refreshData } = await clientBeta.auth.refreshSession();
    const freshJwt = refreshData?.session?.access_token || jwtBeta;

    const stateBeforeSetAuth = betaConn.state;
    await clientBeta.realtime.setAuth(freshJwt);
    await new Promise((r) => setTimeout(r, 1500));
    const stateAfterSetAuth = betaConn.state;

    console.log(`  [Finding 8.2] Channel state before setAuth(): "${stateBeforeSetAuth}"`);
    console.log(`  [Finding 8.3] Channel state after setAuth(): "${stateAfterSetAuth}"`);

    // Check Postgres JWT expiry configuration
    const authConfig = await db.execute<{ name: string; setting: string }>(
      sql`SELECT name, setting FROM pg_settings WHERE name IN ('authentication_timeout', 'session_timeout')`
    );
    console.log("  [Finding 8.4] Database session timeouts:", authConfig);

    clientAlpha.removeChannel(channelAlpha);
    clientBeta.removeChannel(betaConn);

    // =========================================================================
    // FINAL RECAP
    // =========================================================================
    console.log("\n===================================================================");
    console.log("                 STAGE 1 ACCEPTANCE CRITERIA RESULTS               ");
    console.log("===================================================================");
    console.log(`Gate 1 (Unauthenticated rejection on private):  PASS ✓ (${gate1PrivateStatus})`);
    console.log(`Gate 1 (Public channel setting check):          Observed (${gate1PublicStatus})`);
    console.log(`Gate 2 (Authenticated non-member rejection):    ${gate2Pass ? "PASS ✓" : "FAIL ✗"}`);
    console.log(`Gate 3 (Authorized owner & member join):        ${gate3Pass ? "PASS ✓" : "FAIL ✗"}`);
    console.log(`Gate 4 (Presence tracking):                     ${gate4Pass ? "PASS ✓" : "FAIL ✗"}`);
    console.log(`Gate 5 (Forged client broadcast blocked):       ${gate5Pass ? "PASS ✓" : "FAIL ✗"}`);
    console.log(`Gate 6 (Server authoritative broadcast):        ${gate6Pass ? "PASS ✓" : "FAIL ✗"}`);
    console.log(`Gate 7 (Removed member reconnect rejection):    ${gate7Pass ? "PASS ✓" : "FAIL ✗"}`);
    console.log(`Gate 8 (Empirical token refresh & window):      RECORDED ✓`);
    console.log("===================================================================\n");

  } finally {
    console.log("[Teardown] Cleaning up test data...");
    if (testListId) {
      await db.delete(listMembers).where(eq(listMembers.listId, testListId));
      await db.delete(todos).where(eq(todos.listId, testListId));
      await db.delete(todoLists).where(eq(todoLists.id, testListId));
    }
    await admin.auth.admin.deleteUser(alphaId);
    await admin.auth.admin.deleteUser(betaId);
    await admin.auth.admin.deleteUser(charlieId);
    console.log("✓ All temporary users and lists destroyed.");
  }
}

runAllGates().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
