import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function applyMigration() {
  console.log("=== Applying Phase 8 Migration: Tags and Labels ===");
  const migrationPath = path.join(__dirname, "../src/db/migrations/0007_task_tags_and_labels.sql");
  const sqlContent = fs.readFileSync(migrationPath, "utf-8");

  console.log(`Reading SQL from: ${migrationPath}`);
  await db.execute(sql.raw(sqlContent));
  console.log("✓ Migration executed successfully!");

  // Verify tables
  const tables = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name IN ('tags', 'todo_tags');
  `);
  console.log("Verified tables in database:", tables);

  // Verify indexes
  const indexes = await db.execute(sql`
    SELECT indexname, tablename 
    FROM pg_indexes 
    WHERE tablename IN ('tags', 'todo_tags');
  `);
  console.log("Verified indexes:", indexes);
}

applyMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
