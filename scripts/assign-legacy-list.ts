import { db } from "../src/db";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const TARGET_LIST_ID = "00000000-0000-4000-8000-000000000001";
const TARGET_USER_ID = "71e34396-3822-4fc2-8068-4c0cdf3f86cb";
const DUPLICATE_LIST_ID = "2838c660-03e7-4121-91fc-98fc5c966cc8";

async function runAssignment() {
  console.log("=================================================");
  console.log("Phase 4.2: Targeted Legacy List Ownership Assignment");
  console.log("=================================================");

  // 1. Verify user exists in auth.users
  console.log("\n[Step 1] Verifying target user in auth.users...");
  const userCheck = await db.execute(sql`
    SELECT id, email FROM auth.users WHERE id = ${TARGET_USER_ID}::uuid;
  `);
  if (userCheck.length === 0) {
    throw new Error(`Target user with ID ${TARGET_USER_ID} was not found in auth.users!`);
  }
  console.log(`  ✓ Verified user: ${userCheck[0]?.email} (${TARGET_USER_ID})`);

  // 2. Verify legacy list state prior to update
  console.log("\n[Step 2] Verifying legacy list prior to update...");
  const listPreCheck = await db.execute(sql`
    SELECT id, name, user_id, created_at, updated_at
    FROM todo_lists
    WHERE id = ${TARGET_LIST_ID}::uuid;
  `);
  if (listPreCheck.length === 0) {
    throw new Error(`Legacy list ${TARGET_LIST_ID} was not found!`);
  }
  if (listPreCheck[0]?.user_id !== null) {
    throw new Error(`Legacy list ${TARGET_LIST_ID} already has a user_id: ${listPreCheck[0]?.user_id}`);
  }
  console.log(`  ✓ Found target list: '${listPreCheck[0]?.name}' with user_id = NULL`);

  // 3. Execute targeted UPDATE on legacy list
  console.log("\n[Step 3] Executing targeted UPDATE on legacy list...");
  const updateResult = await db.execute(sql`
    UPDATE todo_lists
    SET user_id = ${TARGET_USER_ID}::uuid
    WHERE id = ${TARGET_LIST_ID}::uuid
      AND user_id IS NULL
    RETURNING id, name, user_id, created_at, updated_at;
  `);

  if (updateResult.length !== 1) {
    throw new Error(`Expected exactly 1 row updated, got ${updateResult.length}!`);
  }
  console.log("  ✓ Successfully updated exactly 1 row:");
  console.log(JSON.stringify(updateResult[0], null, 2));

  // 4. Clean up the empty auto-provisioned duplicate list
  console.log("\n[Step 4] Cleaning up empty duplicate list...");
  const deleteResult = await db.execute(sql`
    DELETE FROM todo_lists
    WHERE id = ${DUPLICATE_LIST_ID}::uuid
      AND user_id = ${TARGET_USER_ID}::uuid
    RETURNING id, name;
  `);
  console.log(`  ✓ Cleaned up duplicate list: ${deleteResult.length} row(s) removed.`);

  // 5. Final verification of user's lists
  console.log("\n[Step 5] Final verification of user's lists...");
  const userLists = await db.execute(sql`
    SELECT id, name, user_id, created_at, updated_at
    FROM todo_lists
    WHERE user_id = ${TARGET_USER_ID}::uuid;
  `);
  console.log(`User now owns ${userLists.length} list(s):`);
  console.log(JSON.stringify(userLists, null, 2));

  if (userLists.length !== 1 || userLists[0]?.id !== TARGET_LIST_ID) {
    throw new Error("Assertion failed: user does not own the expected legacy list!");
  }

  console.log("\n=================================================");
  console.log("OWNERSHIP ASSIGNMENT COMPLETED & VERIFIED (100%)");
  console.log("=================================================");
  process.exit(0);
}

runAssignment().catch((err) => {
  console.error("Assignment failed:", err);
  process.exit(1);
});
