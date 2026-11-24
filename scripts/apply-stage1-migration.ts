import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function applyStage1() {
  console.log("=== Phase 11 Stage 1: Applying Realtime Authorization Policies ===");

  // 1. Verify RLS status on realtime.messages
  console.log("\n[1] Verifying existing RLS status on realtime.messages (non-destructive)...");
  try {
    const rlsCheck = await db.execute(sql`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'realtime' AND c.relname = 'messages';
    `);
    console.log("RLS Check Result:", rlsCheck);
  } catch (err) {
    console.warn("Could not check pg_class directly, continuing:", err);
  }

  // 2. Read and apply 0011_realtime_authorization.sql
  const migrationPath = path.join(__dirname, "../src/db/migrations/0011_realtime_authorization.sql");
  const sqlContent = fs.readFileSync(migrationPath, "utf-8");
  console.log(`\n[2] Executing SQL policies from ${migrationPath}...`);
  await db.execute(sql.raw(sqlContent));
  console.log("✓ SQL policies executed successfully!");

  // 3. Verify created policies on realtime.messages
  console.log("\n[3] Verifying created policies on realtime.messages...");
  const policies = await db.execute(sql`
    SELECT policyname, permissive, roles, cmd
    FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages';
  `);
  console.log("Active policies on realtime.messages:", policies);

  // 4. Query current auth JWT expiry settings if available
  console.log("\n[4] Querying instance auth configuration for JWT expiry...");
  try {
    const authConfig = await db.execute(sql`
      SELECT name, setting 
      FROM pg_settings 
      WHERE name LIKE '%jwt%' OR name LIKE '%auth%';
    `);
    console.log("pg_settings auth/jwt:", authConfig);
  } catch (err) {
    console.log("pg_settings query note:", err);
  }

  console.log("\n=== Stage 1 Migration Application Complete ===");
  process.exit(0);
}

applyStage1().catch((err) => {
  console.error("Stage 1 migration application failed:", err);
  process.exit(1);
});
