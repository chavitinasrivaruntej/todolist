import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function applyMigration() {
  console.log("=== Applying Phase 11 Migration: Task Versioning ===");
  const migrationPath = path.join(__dirname, "../src/db/migrations/0010_task_versioning.sql");
  const sqlContent = fs.readFileSync(migrationPath, "utf-8");

  console.log(`Reading SQL from: ${migrationPath}`);
  await db.execute(sql.raw(sqlContent));
  console.log("✓ Migration executed successfully!");

  // Verify version column on todos
  const columns = await db.execute(sql`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'todos' AND column_name = 'version';
  `);
  console.log("Verified 'version' column on 'todos':", columns);

  console.log("=== Phase 11 Migration Complete ===");
  process.exit(0);
}

applyMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
