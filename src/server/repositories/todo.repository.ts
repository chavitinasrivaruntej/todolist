import { eq, desc } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/db";
import { todos, type Todo, type TodoStatus } from "@/db/schema/todos";

export interface ITodoRepository {
  findAllByListId(listId: string): Promise<Todo[]>;
  findById(id: string): Promise<Todo | null>;
  create(data: {
    listId: string;
    title: string;
    description?: string | null;
    status?: TodoStatus;
  }): Promise<Todo>;
  updateStatus(id: string, status: TodoStatus): Promise<Todo | null>;
  delete(id: string): Promise<boolean>;
}

/**
 * TodoRepository provides an abstracted data-access layer for the 'todos' table.
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

  async updateStatus(id: string, status: TodoStatus): Promise<Todo | null> {
    const [updated] = await this.db
      .update(todos)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(todos.id, id))
      .returning();

    return updated ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(todos)
      .where(eq(todos.id, id))
      .returning({ id: todos.id });

    return deleted.length > 0;
  }
}

export const todoRepository = new TodoRepository();
