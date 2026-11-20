-- Phase 10: Task File Attachments & Asset Management

-- 1. Add composite unique constraint on todos(id, list_id) to support composite foreign key
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'todos_id_list_id_unique'
  ) THEN
    ALTER TABLE "todos" ADD CONSTRAINT "todos_id_list_id_unique" UNIQUE ("id", "list_id");
  END IF;
END $$;

-- 2. Create attachment_status enum if not exists
DO $$ BEGIN
  CREATE TYPE "public"."attachment_status" AS ENUM('PENDING_UPLOAD', 'ACTIVE', 'PENDING_DELETION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Create todo_attachments table
CREATE TABLE IF NOT EXISTS "todo_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "todo_id" uuid NOT NULL,
  "list_id" uuid NOT NULL,
  "storage_path" varchar(500) NOT NULL UNIQUE,
  "original_filename" varchar(255) NOT NULL,
  "sanitized_filename" varchar(255) NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "file_size" integer NOT NULL,
  "status" "attachment_status" DEFAULT 'PENDING_UPLOAD' NOT NULL,
  "expires_at" timestamp with time zone,
  "deleted_at" timestamp with time zone,
  "uploaded_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "todo_attachments_todo_list_fk" FOREIGN KEY ("todo_id", "list_id") REFERENCES "todos"("id", "list_id") ON DELETE CASCADE,
  CONSTRAINT "todo_attachments_list_fk" FOREIGN KEY ("list_id") REFERENCES "todo_lists"("id") ON DELETE CASCADE
);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS "todo_attachments_todo_status_created_idx" ON "todo_attachments" ("todo_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "todo_attachments_list_id_idx" ON "todo_attachments" ("list_id");
CREATE INDEX IF NOT EXISTS "todo_attachments_status_expires_idx" ON "todo_attachments" ("status", "expires_at");
CREATE INDEX IF NOT EXISTS "todo_attachments_status_deleted_idx" ON "todo_attachments" ("status", "deleted_at");
CREATE INDEX IF NOT EXISTS "todo_attachments_uploaded_by_idx" ON "todo_attachments" ("uploaded_by");
