import { eq, desc } from "drizzle-orm";
import { db as defaultDb, type Database, type DbExecutor } from "@/db";
import { todos, type Todo, type TodoStatus } from "@/db/schema/todos";

export interface ITodoRepository {
  findAllByListId(listId: string): Promise<Todo[]>;
  findById(id: string): Promise<Todo | null>;
  findListIdByTodoId(id: string): Promise<string | null>;
  create(
    data: {
      listId: string;
      title: string;
      description?: string | null;
      status?: TodoStatus;
    },
    tx?: DbExecutor
  ): Promise<Todo>;
  updateStatus(id: string, status: TodoStatus, tx?: DbExecutor): Promise<Todo | null>;
  updateDetails(
    id: string,
    data: { title?: string; description?: string | null },
    tx?: DbExecutor
  ): Promise<Todo | null>;
  delete(id: string, tx?: DbExecutor): Promise<boolean>;
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

  async findListIdByTodoId(id: string): Promise<string | null> {
    const [result] = await this.db
      .select({ listId: todos.listId })
      .from(todos)
      .where(eq(todos.id, id))
      .limit(1);

    return result?.listId ?? null;
  }

  async create(
    data: {
      listId: string;
      title: string;
      description?: string | null;
      status?: TodoStatus;
    },
    tx?: DbExecutor
  ): Promise<Todo> {
    const executor = tx ?? this.db;
    const [created] = await executor
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

  async updateStatus(
    id: string,
    status: TodoStatus,
    tx?: DbExecutor
  ): Promise<Todo | null> {
    const executor = tx ?? this.db;
    const [updated] = await executor
      .update(todos)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(todos.id, id))
      .returning();

    return updated ?? null;
  }

  async updateDetails(
    id: string,
    data: { title?: string; description?: string | null },
    tx?: DbExecutor
  ): Promise<Todo | null> {
    const executor = tx ?? this.db;
    const updateSet: Partial<typeof todos.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.title !== undefined) updateSet.title = data.title;
    if (data.description !== undefined) updateSet.description = data.description;

    const [updated] = await executor
      .update(todos)
      .set(updateSet)
      .where(eq(todos.id, id))
      .returning();

    return updated ?? null;
  }

  async delete(id: string, tx?: DbExecutor): Promise<boolean> {
    const executor = tx ?? this.db;
    const deleted = await executor
      .delete(todos)
      .where(eq(todos.id, id))
      .returning({ id: todos.id });

    return deleted.length > 0;
  }
}

export const todoRepository = new TodoRepository();
