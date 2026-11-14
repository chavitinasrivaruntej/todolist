import { eq, and, asc, count } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/db";
import { todoLists, type TodoList } from "@/db/schema/lists";
import { todos } from "@/db/schema/todos";

export type TodoListWithTaskCount = TodoList & { taskCount: number };

export interface ITodoListRepository {
  findAllWithTaskCounts(userId: string): Promise<TodoListWithTaskCount[]>;
  findById(id: string, userId?: string): Promise<TodoList | null>;
  create(data: { name: string; userId: string }): Promise<TodoList>;
  updateName(id: string, name: string, userId: string): Promise<TodoList | null>;
  delete(id: string, userId: string): Promise<boolean>;
  countTasksByListId(id: string): Promise<number>;
}

/**
 * TodoListRepository handles all database interactions for the 'todo_lists' table.
 * All operations enforce strict multi-tenant tenant isolation via user ownership (userId).
 */
export class TodoListRepository implements ITodoListRepository {
  private readonly db: Database;

  constructor(database: Database = defaultDb) {
    this.db = database;
  }

  async findAllWithTaskCounts(userId: string): Promise<TodoListWithTaskCount[]> {
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
    }));
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

  async create(data: { name: string; userId: string }): Promise<TodoList> {
    const [created] = await this.db
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

  async updateName(id: string, name: string, userId: string): Promise<TodoList | null> {
    const [updated] = await this.db
      .update(todoLists)
      .set({
        name,
        updatedAt: new Date(),
      })
      .where(and(eq(todoLists.id, id), eq(todoLists.userId, userId)))
      .returning();

    return updated ?? null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(todoLists)
      .where(and(eq(todoLists.id, id), eq(todoLists.userId, userId)))
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
