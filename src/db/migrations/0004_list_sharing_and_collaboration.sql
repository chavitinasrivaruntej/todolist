CREATE TABLE IF NOT EXISTS "list_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "list_id" uuid NOT NULL REFERENCES "todo_lists"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE cascade,
  "role" varchar(20) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "list_members_list_user_unique" ON "list_members" ("list_id", "user_id");
CREATE INDEX IF NOT EXISTS "list_members_user_id_idx" ON "list_members" ("user_id");
CREATE INDEX IF NOT EXISTS "list_members_list_id_idx" ON "list_members" ("list_id");

CREATE TABLE IF NOT EXISTS "list_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "list_id" uuid NOT NULL REFERENCES "todo_lists"("id") ON DELETE cascade,
  "inviter_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE cascade,
  "email" varchar(255) NOT NULL,
  "role" varchar(20) NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "status" varchar(20) DEFAULT 'PENDING' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "accepted_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "list_invitations_token_hash_unique" ON "list_invitations" ("token_hash");
CREATE INDEX IF NOT EXISTS "list_invitations_list_status_idx" ON "list_invitations" ("list_id", "status");
CREATE INDEX IF NOT EXISTS "list_invitations_email_status_idx" ON "list_invitations" ("email", "status");

ALTER TABLE "list_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "list_invitations" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- RLS: list_members
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'list_members' AND policyname = 'Users can view members of lists they belong to'
  ) THEN
    CREATE POLICY "Users can view members of lists they belong to"
    ON "list_members" FOR SELECT TO authenticated
    USING (
      user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM todo_lists WHERE id = list_members.list_id AND user_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM list_members lm WHERE lm.list_id = list_members.list_id AND lm.user_id = auth.uid())
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'list_members' AND policyname = 'Only list owners can manage members'
  ) THEN
    CREATE POLICY "Only list owners can manage members"
    ON "list_members" FOR ALL TO authenticated
    USING (
      EXISTS (SELECT 1 FROM todo_lists WHERE id = list_members.list_id AND user_id = auth.uid())
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM todo_lists WHERE id = list_members.list_id AND user_id = auth.uid())
    );
  END IF;

  -- RLS: list_invitations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'list_invitations' AND policyname = 'Owners can view and manage list invitations'
  ) THEN
    CREATE POLICY "Owners can view and manage list invitations"
    ON "list_invitations" FOR ALL TO authenticated
    USING (
      EXISTS (SELECT 1 FROM todo_lists WHERE id = list_invitations.list_id AND user_id = auth.uid())
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM todo_lists WHERE id = list_invitations.list_id AND user_id = auth.uid())
    );
  END IF;

  -- RLS: update todo_lists policies to allow members to SELECT
  DROP POLICY IF EXISTS "Users can only access their own lists" ON "todo_lists";
  DROP POLICY IF EXISTS "Users can access their own or shared lists" ON "todo_lists";
  CREATE POLICY "Users can access their own or shared lists"
  ON "todo_lists" FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM list_members WHERE list_members.list_id = todo_lists.id AND list_members.user_id = auth.uid())
  );

  DROP POLICY IF EXISTS "Only owners can modify lists" ON "todo_lists";
  CREATE POLICY "Only owners can modify lists"
  ON "todo_lists" FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

  DROP POLICY IF EXISTS "Only owners can delete lists" ON "todo_lists";
  CREATE POLICY "Only owners can delete lists"
  ON "todo_lists" FOR DELETE TO authenticated
  USING (user_id = auth.uid());

  -- RLS: update todos policies
  DROP POLICY IF EXISTS "Users can only access todos in their own lists" ON "todos";
  DROP POLICY IF EXISTS "Owners and members can view todos" ON "todos";
  CREATE POLICY "Owners and members can view todos"
  ON "todos" FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM todo_lists
      WHERE todo_lists.id = todos.list_id
        AND (
          todo_lists.user_id = auth.uid() OR
          EXISTS (SELECT 1 FROM list_members WHERE list_members.list_id = todo_lists.id AND list_members.user_id = auth.uid())
        )
    )
  );

  DROP POLICY IF EXISTS "Owners and editors can modify todos" ON "todos";
  CREATE POLICY "Owners and editors can modify todos"
  ON "todos" FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM todo_lists
      WHERE todo_lists.id = todos.list_id
        AND (
          todo_lists.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM list_members
            WHERE list_members.list_id = todo_lists.id
              AND list_members.user_id = auth.uid()
              AND list_members.role = 'EDITOR'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM todo_lists
      WHERE todo_lists.id = todos.list_id
        AND (
          todo_lists.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM list_members
            WHERE list_members.list_id = todo_lists.id
              AND list_members.user_id = auth.uid()
              AND list_members.role = 'EDITOR'
          )
        )
    )
  );
END $$;

