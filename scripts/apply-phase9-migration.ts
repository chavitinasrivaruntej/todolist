import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function applyMigration() {
  console.log("=== Applying Phase 9 Migration: Recurring Tasks & Schedules ===");
  const migrationPath = path.join(__dirname, "../src/db/migrations/0008_recurring_tasks_and_schedules.sql");
  const sqlContent = fs.readFileSync(migrationPath, "utf-8");

  console.log(`Reading SQL from: ${migrationPath}`);
  await db.execute(sql.raw(sqlContent));
  console.log("✓ Migration executed successfully!");

  // Verify table
  const tables = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'recurrence_rules';
  `);
  console.log("Verified table in database:", tables);

  // Verify columns on todos
  const cols = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'todos' AND column_name IN ('recurrence_rule_id', 'occurrence_number');
  `);
  console.log("Verified columns on todos:", cols);

  // Verify indexes
  const indexes = await db.execute(sql`
    SELECT indexname, tablename 
    FROM pg_indexes 
    WHERE tablename IN ('recurrence_rules', 'todos') AND indexname LIKE '%recurrence%';
  `);
  console.log("Verified recurrence indexes:", indexes);
}

applyMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
