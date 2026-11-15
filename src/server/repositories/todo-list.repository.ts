import { eq, and, asc, count } from "drizzle-orm";
import { db as defaultDb, type Database, type DbExecutor } from "@/db";
import { todoLists, type TodoList } from "@/db/schema/lists";
import { todos } from "@/db/schema/todos";
import { listMembers } from "@/db/schema/members";

export type TodoListWithTaskCount = TodoList & {
  taskCount: number;
  effectiveRole: "OWNER" | "EDITOR" | "VIEWER";
  ownerEmail?: string | null;
};

export interface ITodoListRepository {
  findAllWithTaskCounts(userId: string): Promise<TodoListWithTaskCount[]>;
  findOwnedWithTaskCounts(userId: string): Promise<TodoListWithTaskCount[]>;
  findSharedWithTaskCounts(userId: string): Promise<TodoListWithTaskCount[]>;
  findById(id: string, userId?: string): Promise<TodoList | null>;
  create(data: { name: string; userId: string }, tx?: DbExecutor): Promise<TodoList>;
  updateName(id: string, name: string, tx?: DbExecutor): Promise<TodoList | null>;
  delete(id: string, tx?: DbExecutor): Promise<boolean>;
  countTasksByListId(id: string): Promise<number>;
}

/**
 * TodoListRepository handles database operations for 'todo_lists' and multi-tenant list aggregation.
 */
export class TodoListRepository implements ITodoListRepository {
  private readonly db: Database;

  constructor(database: Database = defaultDb) {
    this.db = database;
  }

  async findOwnedWithTaskCounts(userId: string): Promise<TodoListWithTaskCount[]> {
    const rows = await this.db
      .select({
        id: todoLists.id,
        userId: todoLists.userId,
        name: todoLists.name,
        createdAt: todoLists.createdAt,
        updatedAt: todoLists.updatedAt,
        taskCount: count(todos.id),
      })
      .from(todoLists)
      .leftJoin(todos, eq(todos.listId, todoLists.id))
      .where(eq(todoLists.userId, userId))
      .groupBy(todoLists.id)
      .orderBy(asc(todoLists.createdAt));

    return rows.map((r) => ({
      ...r,
      taskCount: Number(r.taskCount),
      effectiveRole: "OWNER",
    }));
  }

  async findSharedWithTaskCounts(userId: string): Promise<TodoListWithTaskCount[]> {
    const rows = await this.db
      .select({
        id: todoLists.id,
        userId: todoLists.userId,
        name: todoLists.name,
        createdAt: todoLists.createdAt,
        updatedAt: todoLists.updatedAt,
        taskCount: count(todos.id),
        role: listMembers.role,
      })
      .from(listMembers)
      .innerJoin(todoLists, eq(todoLists.id, listMembers.listId))
      .leftJoin(todos, eq(todos.listId, todoLists.id))
      .where(eq(listMembers.userId, userId))
      .groupBy(todoLists.id, listMembers.role)
      .orderBy(asc(listMembers.createdAt));

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      taskCount: Number(r.taskCount),
      effectiveRole: r.role as "EDITOR" | "VIEWER",
    }));
  }

  async findAllWithTaskCounts(userId: string): Promise<TodoListWithTaskCount[]> {
    const [owned, shared] = await Promise.all([
      this.findOwnedWithTaskCounts(userId),
      this.findSharedWithTaskCounts(userId),
    ]);

    return [...owned, ...shared];
  }

  async findById(id: string, userId?: string): Promise<TodoList | null> {
    const conditions = [eq(todoLists.id, id)];
    if (userId) {
      conditions.push(eq(todoLists.userId, userId));
    }

    const [result] = await this.db
      .select()
      .from(todoLists)
      .where(and(...conditions))
      .limit(1);

    return result ?? null;
  }

  async create(
    data: { name: string; userId: string },
    tx?: DbExecutor
  ): Promise<TodoList> {
    const executor = tx ?? this.db;
    const [created] = await executor
      .insert(todoLists)
      .values({
        name: data.name,
        userId: data.userId,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to insert todo_list record.");
    }

    return created;
  }

  async updateName(
    id: string,
    name: string,
    tx?: DbExecutor
  ): Promise<TodoList | null> {
    const executor = tx ?? this.db;
    const [updated] = await executor
      .update(todoLists)
      .set({
        name,
        updatedAt: new Date(),
      })
      .where(eq(todoLists.id, id))
      .returning();

    return updated ?? null;
  }

  async delete(id: string, tx?: DbExecutor): Promise<boolean> {
    const executor = tx ?? this.db;
    const deleted = await executor
      .delete(todoLists)
      .where(eq(todoLists.id, id))
      .returning({ id: todoLists.id });

    return deleted.length > 0;
  }

  async countTasksByListId(id: string): Promise<number> {
    const [res] = await this.db
      .select({ taskCount: count(todos.id) })
      .from(todos)
      .where(eq(todos.listId, id));

    return Number(res?.taskCount ?? 0);
  }
}

export const todoListRepository = new TodoListRepository();
