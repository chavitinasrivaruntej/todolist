DO $$ BEGIN
  CREATE TYPE "todo_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "todos"
  ADD COLUMN IF NOT EXISTS "priority" "todo_priority" DEFAULT 'MEDIUM' NOT NULL,
  ADD COLUMN IF NOT EXISTS "due_date" date;

CREATE INDEX IF NOT EXISTS "todos_list_id_due_date_idx"
  ON "todos" ("list_id", "due_date" ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS "todos_list_id_priority_idx"
  ON "todos" ("list_id", "priority");

