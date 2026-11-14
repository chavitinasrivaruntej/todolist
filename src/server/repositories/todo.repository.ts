import { eq, and, inArray, desc } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/db";
import { todos, type Todo, type TodoStatus } from "@/db/schema/todos";
import { todoLists } from "@/db/schema/lists";

export interface ITodoRepository {
  findAllByListId(listId: string): Promise<Todo[]>;
  findById(id: string): Promise<Todo | null>;
  create(data: {
    listId: string;
    title: string;
    description?: string | null;
    status?: TodoStatus;
  }): Promise<Todo>;
  updateStatus(id: string, status: TodoStatus, userId?: string): Promise<Todo | null>;
  delete(id: string, userId?: string): Promise<boolean>;
}

/**
 * TodoRepository provides an abstracted data-access layer for the 'todos' table.
 * All mutations enforce multi-tenant authorization by scoping task updates/deletions
 * to lists owned by the specified user (userId).
 */
export class TodoRepository implements ITodoRepository {
  private readonly db: Database;

  constructor(database: Database = defaultDb) {
    this.db = database;
  }

  async findAllByListId(listId: string): Promise<Todo[]> {
    return this.db
      .select()
      .from(todos)
      .where(eq(todos.listId, listId))
      .orderBy(desc(todos.createdAt));
  }

  async findById(id: string): Promise<Todo | null> {
    const [result] = await this.db
      .select()
      .from(todos)
      .where(eq(todos.id, id))
      .limit(1);

    return result ?? null;
  }

  async create(data: {
    listId: string;
    title: string;
    description?: string | null;
    status?: TodoStatus;
  }): Promise<Todo> {
    const [created] = await this.db
      .insert(todos)
      .values({
        listId: data.listId,
        title: data.title,
        description: data.description ?? null,
        status: data.status ?? "TODO",
      })
      .returning();

    if (!created) {
      throw new Error("Failed to insert todo record into the database.");
    }

    return created;
  }

  async updateStatus(id: string, status: TodoStatus, userId?: string): Promise<Todo | null> {
    const conditions = [eq(todos.id, id)];
    if (userId) {
      const userListIds = this.db
        .select({ id: todoLists.id })
        .from(todoLists)
        .where(eq(todoLists.userId, userId));
      conditions.push(inArray(todos.listId, userListIds));
    }

    const [updated] = await this.db
      .update(todos)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(and(...conditions))
      .returning();

    return updated ?? null;
  }

  async delete(id: string, userId?: string): Promise<boolean> {
    const conditions = [eq(todos.id, id)];
    if (userId) {
      const userListIds = this.db
        .select({ id: todoLists.id })
        .from(todoLists)
        .where(eq(todoLists.userId, userId));
      conditions.push(inArray(todos.listId, userListIds));
    }

    const deleted = await this.db
      .delete(todos)
      .where(and(...conditions))
      .returning({ id: todos.id });

    return deleted.length > 0;
  }
}

export const todoRepository = new TodoRepository();
