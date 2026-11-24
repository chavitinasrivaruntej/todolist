import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function applyHardening() {
  console.log("=== Phase 11 Stage 1: Applying Function Permission Hardening ===");

  // 1. Read and apply 0012_realtime_permission_hardening.sql
  const migrationPath = path.join(__dirname, "../src/db/migrations/0012_realtime_permission_hardening.sql");
  const sqlContent = fs.readFileSync(migrationPath, "utf-8");
  console.log(`\n[1] Executing SQL statements from ${migrationPath}...`);
  await db.execute(sql.raw(sqlContent));
  console.log("✓ SQL statements executed successfully!");

  // 2. Verify actual routine privileges in information_schema
  console.log("\n[2] Verifying updated routine privileges in information_schema...");
  const privs = await db.execute(sql`
    SELECT grantee, privilege_type, is_grantable
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public' AND routine_name = 'authorize_realtime_list_access';
  `);
  console.log("Routine Privileges:", privs);

  // 3. Verify has_function_privilege for all key roles
  console.log("\n[3] Checking has_function_privilege for key roles...");
  const roles = ["public", "anon", "authenticated", "service_role", "postgres"];
  for (const role of roles) {
    const res = await db.execute<{ can_execute: boolean }>(sql`
      SELECT has_function_privilege(${role}, 'public.authorize_realtime_list_access(text, uuid)', 'EXECUTE') AS can_execute;
    `);
    console.log(`  Role '${role}': can_execute = ${res[0]?.can_execute}`);
  }

  // 4. Test anonymous direct invocation in PostgreSQL
  console.log("\n[4] Testing direct invocation as role 'anon' in PostgreSQL transaction...");
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SET ROLE anon`);
      await tx.execute(sql`
        SELECT public.authorize_realtime_list_access('realtime:list:00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'::uuid);
      `);
    });
    console.error("❌ ERROR: Anonymous direct execution succeeded when it should have been denied!");
  } catch (err: any) {
    console.log("✓ Direct anonymous execution successfully DENIED:", err.message);
  }

  // 5. Test authenticated direct invocation in PostgreSQL
  console.log("\n[5] Testing direct invocation as role 'authenticated' in PostgreSQL transaction...");
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SET ROLE authenticated`);
      const res = await tx.execute(sql`
        SELECT public.authorize_realtime_list_access('realtime:list:00000000-0000-4000-8000-000000000001', '71e34396-3822-4fc2-8068-4c0cdf3f86cb'::uuid) as allowed;
      `);
      console.log("✓ Authenticated execution successfully allowed, result:", res);
    });
  } catch (err: any) {
    console.error("❌ ERROR: Authenticated direct execution failed:", err.message);
  }

  console.log("\n=== Hardening Migration Complete ===");
  process.exit(0);
}

applyHardening().catch((err) => {
  console.error("Hardening migration failed:", err);
  process.exit(1);
});
