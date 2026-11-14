import { eq, asc, count } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/db";
import { todoLists, type TodoList } from "@/db/schema/lists";
import { todos } from "@/db/schema/todos";

export type TodoListWithTaskCount = TodoList & { taskCount: number };

export interface ITodoListRepository {
  findAllWithTaskCounts(): Promise<TodoListWithTaskCount[]>;
  findById(id: string): Promise<TodoList | null>;
  create(data: { name: string }): Promise<TodoList>;
  updateName(id: string, name: string): Promise<TodoList | null>;
  delete(id: string): Promise<boolean>;
  countTasksByListId(id: string): Promise<number>;
}

/**
 * TodoListRepository handles all database interactions for the 'todo_lists' table.
 */
export class TodoListRepository implements ITodoListRepository {
  private readonly db: Database;

  constructor(database: Database = defaultDb) {
    this.db = database;
  }

  async findAllWithTaskCounts(): Promise<TodoListWithTaskCount[]> {
    const rows = await this.db
      .select({
        id: todoLists.id,
        name: todoLists.name,
        createdAt: todoLists.createdAt,
        updatedAt: todoLists.updatedAt,
        taskCount: count(todos.id),
      })
      .from(todoLists)
      .leftJoin(todos, eq(todos.listId, todoLists.id))
      .groupBy(todoLists.id)
      .orderBy(asc(todoLists.createdAt));

    return rows.map((r) => ({
      ...r,
      taskCount: Number(r.taskCount),
    }));
  }

  async findById(id: string): Promise<TodoList | null> {
    const [result] = await this.db
      .select()
      .from(todoLists)
      .where(eq(todoLists.id, id))
      .limit(1);

    return result ?? null;
  }

  async create(data: { name: string }): Promise<TodoList> {
    const [created] = await this.db
      .insert(todoLists)
      .values({
        name: data.name,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to insert todo_list record.");
    }

    return created;
  }

  async updateName(id: string, name: string): Promise<TodoList | null> {
    const [updated] = await this.db
      .update(todoLists)
      .set({
        name,
        updatedAt: new Date(),
      })
      .where(eq(todoLists.id, id))
      .returning();

    return updated ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db
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

