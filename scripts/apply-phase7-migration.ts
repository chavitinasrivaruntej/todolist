import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function applyMigration() {
  console.log("=== Applying Phase 7 Migration ===");
  const migrationPath = path.join(__dirname, "../src/db/migrations/0006_task_priorities_and_due_dates.sql");
  const sqlContent = fs.readFileSync(migrationPath, "utf-8");

  console.log(`Reading SQL from: ${migrationPath}`);
  await db.execute(sql.raw(sqlContent));
  console.log("✓ Migration executed successfully!");

  // Verify column existence and enum values
  const columns = await db.execute(sql`
    SELECT column_name, data_type, udt_name, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'todos' AND column_name IN ('priority', 'due_date');
  `);
  console.log("Column definitions in 'todos':", columns);

  // Verify indexes
  const indexes = await db.execute(sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'todos' AND indexname IN ('todos_list_id_due_date_idx', 'todos_list_id_priority_idx');
  `);
  console.log("Indexes on 'todos':", indexes);
}

applyMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });

