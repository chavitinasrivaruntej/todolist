import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { todoLists, listMembers, todos, tags, todoTags, activityLogs } from "../src/db/schema";
import { analyticsService } from "../src/server/services/analytics.service";
import { NotFoundError } from "../src/server/errors";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runPhase12LiveVerification() {
  console.log("===================================================================");
  console.log("     CAIZE TODO — PHASE 12 LIVE DATABASE & ANALYTICS VERIFICATION  ");
  console.log("===================================================================");

  const timestamp = Date.now();
  const password = `Phase12Pass!_${timestamp}`;
  const ownerEmail = `p12-owner-${timestamp}@test.local`;
  const viewerEmail = `p12-viewer-${timestamp}@test.local`;
  const strangerEmail = `p12-stranger-${timestamp}@test.local`;

  let ownerId = "";
  let viewerId = "";
  let strangerId = "";
  let testListId: string | null = null;

  try {
    // 1. Apply 0013_analytics_indexes.sql idempotently & verify indexes
    console.log("\n[1] Ensuring 0013_analytics_indexes.sql is applied...");
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "src/db/migrations/0013_analytics_indexes.sql"),
      "utf8"
    );
    await db.execute(sql.raw(migrationSql));

    const idxRows = await db.execute(sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN ('todos_list_id_status_idx', 'activity_logs_list_action_created_idx')
      ORDER BY indexname
    `);
    const foundIndexes = (idxRows as unknown as { indexname: string }[]).map((r) => r.indexname);
    if (foundIndexes.length !== 2) {
      throw new Error(`Expected 2 analytics indexes, found: ${foundIndexes.join(", ")}`);
    }
    console.log(`✓ Indexes verified in PostgreSQL: ${foundIndexes.join(", ")}`);

    // 2. Provision temporary test users
    console.log("\n[2] Provisioning temporary test users...");
    const [u1, u2, u3] = await Promise.all([
      admin.auth.admin.createUser({ email: ownerEmail, password, email_confirm: true }),
      admin.auth.admin.createUser({ email: viewerEmail, password, email_confirm: true }),
      admin.auth.admin.createUser({ email: strangerEmail, password, email_confirm: true }),
    ]);
    if (u1.error || u2.error || u3.error) {
      throw new Error("Failed to provision test users");
    }
    ownerId = u1.data.user.id;
    viewerId = u2.data.user.id;
    strangerId = u3.data.user.id;

    // 3. Create list, memberships, tags, tasks, and activity logs
    const [list] = await db
      .insert(todoLists)
      .values({ name: `Phase 12 Test List ${timestamp}`, userId: ownerId })
      .returning();
    testListId = list.id;

    await db.insert(listMembers).values({
      listId: testListId,
      userId: viewerId,
      role: "VIEWER",
    });

    const [tag] = await db
      .insert(tags)
      .values({ listId: testListId, name: "AnalyticsTest", color: "indigo" })
      .returning();

    const now = new Date();
    const yesterdayStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
      .toISOString()
      .slice(0, 10);

    const [tOverdue, tDone] = await db
      .insert(todos)
      .values([
        {
          listId: testListId,
          title: "=Overdue Formula Task",
          status: "TODO",
          priority: "URGENT",
          dueDate: yesterdayStr,
        },
        {
          listId: testListId,
          title: "Completed Task",
          status: "DONE",
          priority: "HIGH",
          dueDate: null,
        },
      ])
      .returning();

    await db.insert(todoTags).values({ todoId: tDone.id, tagId: tag.id });

    await db.insert(activityLogs).values([
      {
        listId: testListId,
        actorId: ownerId,
        action: "TODO_CREATED",
        entityType: "TODO",
        entityId: tOverdue.id,
        metadata: { status: "TODO" },
      },
      {
        listId: testListId,
        actorId: ownerId,
        action: "TODO_CREATED",
        entityType: "TODO",
        entityId: tDone.id,
        metadata: { status: "TODO" },
      },
      {
        listId: testListId,
        actorId: ownerId,
        action: "TODO_STATUS_CHANGED",
        entityType: "TODO",
        entityId: tDone.id,
        metadata: { previousStatus: "TODO", newStatus: "DONE" },
      },
    ]);

    // 4. Measure Overview & Velocity queries against live PostgreSQL
    console.log("\n[3] Running live analytics.getOverview and analytics.getVelocity...");
    const t0 = performance.now();
    const overview = await analyticsService.getOverview(viewerId, testListId, now);
    const overviewMs = Math.round((performance.now() - t0) * 100) / 100;

    const t1 = performance.now();
    const velocity = await analyticsService.getVelocity(viewerId, testListId, "30d", now);
    const velocityMs = Math.round((performance.now() - t1) * 100) / 100;

    if (
      overview.totalTasks !== 2 ||
      overview.completedTasks !== 1 ||
      overview.overdueTasks !== 1 ||
      overview.tagDistribution[0]?.count !== 1
    ) {
      throw new Error(`Unexpected overview metrics: ${JSON.stringify(overview)}`);
    }
    if (velocity.totalCreated !== 2 || velocity.totalCompletedEvents !== 1) {
      throw new Error(`Unexpected velocity metrics: ${JSON.stringify(velocity)}`);
    }
    console.log(`✓ Live Overview verified in ${overviewMs} ms (total=2, done=1, overdue=1)`);
    console.log(`✓ Live Velocity verified in ${velocityMs} ms (created=2, completedEvents=1, weeks=${velocity.weeks.length})`);

    // 5. Verify keyset export batching & verified completion timestamp
    const prep = await analyticsService.prepareExport(viewerId, testListId);
    const batch1 = await analyticsService.getExportBatch(prep.listIds, null, 1);
    const batch2 = await analyticsService.getExportBatch(prep.listIds, batch1.nextCursor, 1);
    if (batch1.items.length !== 1 || batch2.items.length !== 1) {
      throw new Error("Keyset export pagination failed");
    }
    const exportedDone = [...batch1.items, ...batch2.items].find((i) => i.id === tDone.id);
    if (!exportedDone?.completedAt) {
      throw new Error("Expected verified completedAt on DONE exported task");
    }
    console.log("✓ Keyset-paginated export batching & verified completedAt confirmed");

    // 6. Verify Stranger (non-member) is denied
    let denied = false;
    try {
      await analyticsService.getOverview(strangerId, testListId);
    } catch (err) {
      if (err instanceof NotFoundError) denied = true;
    }
    if (!denied) {
      throw new Error("Security failure: Stranger was not denied!");
    }
    console.log("✓ Non-member access strictly denied with NotFoundError");

    console.log("\n===================================================================");
    console.log("  PHASE 12 LIVE VERIFICATION COMPLETE: ALL CHECKS PASSED!");
    console.log("===================================================================");
  } finally {
    console.log("\n[Cleanup] Removing temporary test list and users...");
    if (testListId) {
      await db.delete(todoLists).where(eq(todoLists.id, testListId));
    }
    if (ownerId) await admin.auth.admin.deleteUser(ownerId);
    if (viewerId) await admin.auth.admin.deleteUser(viewerId);
    if (strangerId) await admin.auth.admin.deleteUser(strangerId);
    console.log("✓ Cleanup complete");
  }
}

runPhase12LiveVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Live verification failed:", err);
    process.exit(1);
  });
