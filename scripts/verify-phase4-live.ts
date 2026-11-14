import { createClient } from "@supabase/supabase-js";
import { appRouter } from "../src/server/api/root";
import { TRPCError } from "@trpc/server";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase credentials in .env.local.");
}

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runPhase4LiveVerification() {
  console.log("=================================================");
  console.log("Phase 4 Live Supabase Auth & Multi-Tenant Verification");
  console.log("=================================================");

  const timestamp = Date.now();
  const emailAlpha = `phase4-alpha-${timestamp}@test.local`;
  const emailBeta = `phase4-beta-${timestamp}@test.local`;
  const testPassword = `TestPass!123456_${timestamp}`;

  let userAlphaId = "";
  let userBetaId = "";

  try {
    // Step 1: Provision User Alpha and User Beta
    console.log("\n[Step 1] Provisioning test users...");
    const { data: alphaData, error: alphaErr } = await adminSupabase.auth.admin.createUser({
      email: emailAlpha,
      password: testPassword,
      email_confirm: true,
    });
    if (alphaErr || !alphaData.user) {
      throw new Error(`Failed to create User Alpha: ${alphaErr?.message}`);
    }
    userAlphaId = alphaData.user.id;
    console.log(`  ✓ Created User Alpha (ID: ${userAlphaId})`);

    const { data: betaData, error: betaErr } = await adminSupabase.auth.admin.createUser({
      email: emailBeta,
      password: testPassword,
      email_confirm: true,
    });
    if (betaErr || !betaData.user) {
      throw new Error(`Failed to create User Beta: ${betaErr?.message}`);
    }
    userBetaId = betaData.user.id;
    console.log(`  ✓ Created User Beta (ID: ${userBetaId})`);

    // Step 2: Test Unauthenticated Rejection (Zero Trust)
    console.log("\n[Step 2] Verifying unauthenticated rejection across API layer...");
    const unauthedCaller = appRouter.createCaller({
      headers: undefined,
      user: null,
    });

    try {
      await unauthedCaller.todoList.list();
      throw new Error("Security failure: unauthenticated request was not blocked!");
    } catch (err) {
      if (err instanceof TRPCError && err.code === "UNAUTHORIZED") {
        console.log("  ✓ Unauthenticated todoList.list correctly rejected with UNAUTHORIZED");
      } else {
        throw err;
      }
    }

    try {
      await unauthedCaller.todo.create({
        listId: "00000000-0000-4000-8000-000000000001",
        title: "Unauthorized Task",
      });
      throw new Error("Security failure: unauthenticated task creation was not blocked!");
    } catch (err) {
      if (err instanceof TRPCError && err.code === "UNAUTHORIZED") {
        console.log("  ✓ Unauthenticated todo.create correctly rejected with UNAUTHORIZED");
      } else {
        throw err;
      }
    }

    // Step 3: User Alpha creates lists and tasks
    console.log("\n[Step 3] Operating as User Alpha...");
    const callerAlpha = appRouter.createCaller({
      headers: undefined,
      user: alphaData.user,
    });

    const alphaListsInitial = await callerAlpha.todoList.list();
    console.log(`  ✓ User Alpha auto-provisioned initial lists count: ${alphaListsInitial.length}`);
    const alphaDefaultList = alphaListsInitial[0];
    if (!alphaDefaultList) throw new Error("Expected auto-provisioned list for Alpha");

    const alphaCustomList = await callerAlpha.todoList.create({ name: "Alpha Private Workspace" });
    console.log(`  ✓ User Alpha created custom list (ID: ${alphaCustomList.id})`);

    const alphaTask = await callerAlpha.todo.create({
      listId: alphaCustomList.id,
      title: "Confidential Strategy Doc",
      description: "Only Alpha should ever see this",
      status: "TODO",
    });
    console.log(`  ✓ User Alpha created task (ID: ${alphaTask.id})`);

    // Step 4: User Beta creates independent lists
    console.log("\n[Step 4] Operating as User Beta...");
    const callerBeta = appRouter.createCaller({
      headers: undefined,
      user: betaData.user,
    });

    const betaLists = await callerBeta.todoList.list();
    console.log(`  ✓ User Beta auto-provisioned initial lists count: ${betaLists.length}`);

    // Verify User Beta DOES NOT see Alpha's custom list
    const leakedList = betaLists.find((l) => l.id === alphaCustomList.id);
    if (leakedList) {
      throw new Error("Cross-tenant leakage: User Beta can see User Alpha's list!");
    }
    console.log("  ✓ Strict isolation verified: User Alpha's list is completely invisible to User Beta.");

    // Step 5: Verify User Beta CANNOT read Alpha's tasks
    console.log("\n[Step 5] Verifying cross-tenant task query rejection...");
    try {
      await callerBeta.todo.list({ listId: alphaCustomList.id });
      throw new Error("Security failure: User Beta was able to query User Alpha's task list!");
    } catch (err) {
      if (err instanceof TRPCError && err.code === "NOT_FOUND") {
        console.log("  ✓ Querying Alpha's list by Beta correctly returned NOT_FOUND (zero information disclosure)");
      } else {
        throw err;
      }
    }

    // Step 6: Verify User Beta CANNOT update status of Alpha's task
    console.log("\n[Step 6] Verifying cross-tenant status update rejection...");
    try {
      await callerBeta.todo.updateStatus({
        id: alphaTask.id,
        status: "DONE",
      });
      throw new Error("Security failure: User Beta was able to update status of User Alpha's task!");
    } catch (err) {
      if (err instanceof TRPCError && err.code === "NOT_FOUND") {
        console.log("  ✓ Mutating Alpha's task status by Beta correctly rejected with NOT_FOUND");
      } else {
        throw err;
      }
    }

    // Step 7: Verify User Beta CANNOT delete Alpha's task
    console.log("\n[Step 7] Verifying cross-tenant task deletion rejection...");
    try {
      await callerBeta.todo.delete({
        id: alphaTask.id,
      });
      throw new Error("Security failure: User Beta was able to delete User Alpha's task!");
    } catch (err) {
      if (err instanceof TRPCError && err.code === "NOT_FOUND") {
        console.log("  ✓ Deleting Alpha's task by Beta correctly rejected with NOT_FOUND");
      } else {
        throw err;
      }
    }

    // Step 8: Verify Alpha CAN update and delete their own task
    console.log("\n[Step 8] Verifying User Alpha normal mutations...");
    const updatedAlphaTask = await callerAlpha.todo.updateStatus({
      id: alphaTask.id,
      status: "IN_PROGRESS",
    });
    if (updatedAlphaTask.status !== "IN_PROGRESS") {
      throw new Error("Expected status IN_PROGRESS");
    }
    console.log("  ✓ User Alpha successfully updated status to IN_PROGRESS");

    const deleteResult = await callerAlpha.todo.delete({ id: alphaTask.id });
    if (!deleteResult.success) {
      throw new Error("Expected delete success true");
    }
    console.log("  ✓ User Alpha successfully deleted their own task");

    // Clean up Alpha custom list
    await callerAlpha.todoList.delete({ id: alphaCustomList.id, force: true });
    console.log("  ✓ User Alpha successfully cleaned up custom list");

    console.log("\n=================================================");
    console.log("ALL PHASE 4 LIVE INTEGRATION CHECKS PASSED! (100%)");
    console.log("=================================================");
  } finally {
    // Cleanup test users from Supabase Auth
    console.log("\n[Cleanup] Deleting test users from Supabase Auth...");
    if (userAlphaId) {
      await adminSupabase.auth.admin.deleteUser(userAlphaId);
      console.log(`  ✓ Cleaned up User Alpha (${userAlphaId})`);
    }
    if (userBetaId) {
      await adminSupabase.auth.admin.deleteUser(userBetaId);
      console.log(`  ✓ Cleaned up User Beta (${userBetaId})`);
    }
  }
}

runPhase4LiveVerification().catch((err) => {
  console.error("Verification failed with error:", err);
  process.exit(1);
});
