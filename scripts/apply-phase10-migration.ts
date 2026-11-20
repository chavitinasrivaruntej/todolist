import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { db } from "../src/db";
import { sql } from "drizzle-orm";
import { supabaseStorageAdapter } from "../src/lib/storage/supabase-storage";

async function applyMigration() {
  console.log("=== Applying Phase 10 Migration: Task File Attachments ===");
  const migrationPath = path.join(__dirname, "../src/db/migrations/0009_task_file_attachments.sql");
  const sqlContent = fs.readFileSync(migrationPath, "utf-8");

  console.log(`Reading SQL from: ${migrationPath}`);
  await db.execute(sql.raw(sqlContent));
  console.log("✓ Migration executed successfully!");

  // Verify unique constraint on todos
  const constraints = await db.execute(sql`
    SELECT conname 
    FROM pg_constraint 
    WHERE conname = 'todos_id_list_id_unique';
  `);
  console.log("Verified constraint on todos:", constraints);

  // Verify todo_attachments table
  const tables = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'todo_attachments';
  `);
  console.log("Verified table in database:", tables);

  // Verify indexes
  const indexes = await db.execute(sql`
    SELECT indexname 
    FROM pg_indexes 
    WHERE tablename = 'todo_attachments';
  `);
  console.log("Verified attachments indexes:", indexes);

  // Ensure Supabase Storage private bucket exists
  console.log("Checking / Creating Supabase Storage private bucket...");
  try {
    await supabaseStorageAdapter.ensureBucketExists();
    console.log("✓ Supabase Storage private bucket ensured!");
  } catch (err: unknown) {
    console.warn("Storage bucket setup warning:", err instanceof Error ? err.message : err);
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
