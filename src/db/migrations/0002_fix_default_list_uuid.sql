DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "todo_lists" WHERE "id" = '00000000-0000-0000-0000-000000000001') THEN
    INSERT INTO "todo_lists" ("id", "name", "created_at", "updated_at")
    SELECT '00000000-0000-4000-8000-000000000001'::uuid, "name", "created_at", "updated_at"
    FROM "todo_lists"
    WHERE "id" = '00000000-0000-0000-0000-000000000001'::uuid
    ON CONFLICT ("id") DO NOTHING;

    UPDATE "todos"
    SET "list_id" = '00000000-0000-4000-8000-000000000001'::uuid
    WHERE "list_id" = '00000000-0000-0000-0000-000000000001'::uuid;

    DELETE FROM "todo_lists"
    WHERE "id" = '00000000-0000-0000-0000-000000000001'::uuid;
  ELSE
    INSERT INTO "todo_lists" ("id", "name")
    VALUES ('00000000-0000-4000-8000-000000000001'::uuid, 'Personal')
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

