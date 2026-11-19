CREATE TABLE IF NOT EXISTS "tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "list_id" uuid NOT NULL REFERENCES "todo_lists"("id") ON DELETE CASCADE,
  "name" varchar(50) NOT NULL,
  "color" varchar(30) DEFAULT 'slate' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tags_list_id_name_unique" UNIQUE("list_id", "name")
);

CREATE INDEX IF NOT EXISTS "tags_list_id_idx" ON "tags" ("list_id");
CREATE INDEX IF NOT EXISTS "tags_list_id_name_idx" ON "tags" ("list_id", "name");

CREATE TABLE IF NOT EXISTS "todo_tags" (
  "todo_id" uuid NOT NULL REFERENCES "todos"("id") ON DELETE CASCADE,
  "tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "todo_tags_pkey" PRIMARY KEY("todo_id", "tag_id")
);

CREATE INDEX IF NOT EXISTS "todo_tags_tag_id_idx" ON "todo_tags" ("tag_id");
CREATE INDEX IF NOT EXISTS "todo_tags_todo_id_idx" ON "todo_tags" ("todo_id");

-- Enable Row-Level Security
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todo_tags" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "tags_select_policy" ON "tags"
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "todo_tags_select_policy" ON "todo_tags"
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
