import { eq, desc } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/db";
import { todos, type Todo } from "@/db/schema/todos";

export interface ITodoRepository {
  findAll(): Promise<Todo[]>;
  findById(id: string): Promise<Todo | null>;
  create(data: { title: string; description?: string | null }): Promise<Todo>;
  delete(id: string): Promise<boolean>;
}

/**
 * TodoRepository provides an abstracted data-access layer for the 'todos' table.
 * Isolates SQL and Drizzle ORM operations from application services and tRPC routers.
 */
export class TodoRepository implements ITodoRepository {
  private readonly db: Database;

  constructor(database: Database = defaultDb) {
    this.db = database;
  }

  async findAll(): Promise<Todo[]> {
    return this.db
      .select()
      .from(todos)
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

  async create(data: { title: string; description?: string | null }): Promise<Todo> {
    const [created] = await this.db
      .insert(todos)
      .values({
        title: data.title,
        description: data.description ?? null,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to insert todo record into the database.");
    }

    return created;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(todos)
      .where(eq(todos.id, id))
      .returning({ id: todos.id });

    return deleted.length > 0;
  }
}

// Default singleton instance for application runtime
export const todoRepository = new TodoRepository();
