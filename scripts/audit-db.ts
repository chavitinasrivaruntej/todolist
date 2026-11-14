import { db } from "../src/db";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

async function audit() {
  console.log("=== 1. Connection Role & Privileges ===");
  const roleInfo = await db.execute(sql`
    SELECT r.rolname, r.rolsuper, r.rolinherit, r.rolcreaterole, r.rolcreatedb, r.rolcanlogin, r.rolbypassrls
    FROM pg_roles r
    WHERE r.rolname = current_user;
  `);
  console.log(JSON.stringify(roleInfo, null, 2));

  console.log("\n=== 2. Table RLS Status ===");
  const rlsStatus = await db.execute(sql`
    SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname IN ('todo_lists', 'todos') AND n.nspname = 'public';
  `);
  console.log(JSON.stringify(rlsStatus, null, 2));

  console.log("\n=== 3. Active RLS Policies ===");
  const policies = await db.execute(sql`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename IN ('todo_lists', 'todos');
  `);
  console.log(JSON.stringify(policies, null, 2));

  console.log("\n=== 4. Data Integrity: todo_lists ===");
  const listCounts = await db.execute(sql`
    SELECT 
      COUNT(*) AS total_lists,
      COUNT(*) FILTER (WHERE user_id IS NULL) AS null_user_id_lists,
      COUNT(*) FILTER (WHERE user_id IS NOT NULL) AS assigned_user_id_lists
    FROM todo_lists;
  `);
  console.log(JSON.stringify(listCounts, null, 2));

  const allLists = await db.execute(sql`
    SELECT id, name, user_id, created_at FROM todo_lists;
  `);
  console.log("Lists:", JSON.stringify(allLists, null, 2));

  console.log("\n=== 5. Data Integrity: todos & Foreign Keys ===");
  const todoCounts = await db.execute(sql`
    SELECT 
      COUNT(*) AS total_todos,
      COUNT(*) FILTER (WHERE t.list_id IS NULL) AS null_list_id_todos,
      COUNT(*) FILTER (WHERE l.id IS NULL) AS orphaned_todos
    FROM todos t
    LEFT JOIN todo_lists l ON l.id = t.list_id;
  `);
  console.log(JSON.stringify(todoCounts, null, 2));

  const allTodos = await db.execute(sql`
    SELECT id, list_id, title, status FROM todos LIMIT 10;
  `);
  console.log("Sample Todos:", JSON.stringify(allTodos, null, 2));

  console.log("\n=== 6. Auth Users in auth.users ===");
  const authUsers = await db.execute(sql`
    SELECT id, email, created_at FROM auth.users;
  `);
  console.log("Auth users count:", authUsers.length);
  console.log("Auth users:", JSON.stringify(authUsers, null, 2));

  process.exit(0);
}

audit().catch((err) => {
  console.error("Audit query error:", err);
  process.exit(1);
});
