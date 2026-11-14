ALTER TABLE "todo_lists" ADD COLUMN "user_id" uuid REFERENCES "auth"."users"("id") ON DELETE cascade;
CREATE INDEX "todo_lists_user_id_idx" ON "todo_lists" ("user_id");
CREATE INDEX "todo_lists_user_id_created_at_idx" ON "todo_lists" ("user_id", "created_at");

ALTER TABLE "todo_lists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todos" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'todo_lists' AND policyname = 'Users can only access their own lists'
  ) THEN
    CREATE POLICY "Users can only access their own lists"
    ON "todo_lists"
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'todos' AND policyname = 'Users can only access todos in their own lists'
  ) THEN
    CREATE POLICY "Users can only access todos in their own lists"
    ON "todos"
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM "todo_lists"
        WHERE "todo_lists"."id" = "todos"."list_id"
        AND "todo_lists"."user_id" = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM "todo_lists"
        WHERE "todo_lists"."id" = "todos"."list_id"
        AND "todo_lists"."user_id" = auth.uid()
      )
    );
  END IF;
END $$;
