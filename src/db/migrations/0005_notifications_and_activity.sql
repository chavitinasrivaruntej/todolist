CREATE TABLE IF NOT EXISTS "activity_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "list_id" uuid NOT NULL REFERENCES "todo_lists"("id") ON DELETE cascade,
  "actor_id" uuid REFERENCES "auth"."users"("id") ON DELETE set null,
  "action" varchar(50) NOT NULL,
  "entity_type" varchar(30) NOT NULL,
  "entity_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "activity_logs_list_id_created_at_id_idx" 
  ON "activity_logs" ("list_id", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "activity_logs_actor_id_idx" 
  ON "activity_logs" ("actor_id");

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE cascade,
  "actor_id" uuid REFERENCES "auth"."users"("id") ON DELETE set null,
  "list_id" uuid REFERENCES "todo_lists"("id") ON DELETE set null,
  "type" varchar(50) NOT NULL,
  "title" varchar(255) NOT NULL,
  "message" text NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_idx" 
  ON "notifications" ("user_id", "is_read");
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_id_idx" 
  ON "notifications" ("user_id", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "notifications_list_id_idx" 
  ON "notifications" ("list_id");

ALTER TABLE "activity_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Notifications policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_select_policy'
  ) THEN
    CREATE POLICY "notifications_select_policy"
    ON "notifications" FOR SELECT TO authenticated
    USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_update_policy'
  ) THEN
    CREATE POLICY "notifications_update_policy"
    ON "notifications" FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_delete_policy'
  ) THEN
    CREATE POLICY "notifications_delete_policy"
    ON "notifications" FOR DELETE TO authenticated
    USING (user_id = auth.uid());
  END IF;

  -- Activity logs policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'activity_logs_select_policy'
  ) THEN
    CREATE POLICY "activity_logs_select_policy"
    ON "activity_logs" FOR SELECT TO authenticated
    USING (
      EXISTS (SELECT 1 FROM todo_lists WHERE id = activity_logs.list_id AND user_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM list_members WHERE list_members.list_id = activity_logs.list_id AND list_members.user_id = auth.uid())
    );
  END IF;
END $$;

