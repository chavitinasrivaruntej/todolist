import {
  eq,
  desc,
  asc,
  and,
  or,
  ne,
  ilike,
  isNotNull,
  isNull,
  lt,
  lte,
  gte,
  sql,
} from "drizzle-orm";
import { db as defaultDb, type Database, type DbExecutor } from "@/db";
import {
  todos,
  type Todo,
  type TodoStatus,
  type TodoPriority,
} from "@/db/schema/todos";
import type {
  DueDateFilterType,
  SortFieldType,
  SortDirectionType,
} from "@/lib/validations/todo";

function addDaysToIsoDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export interface FindTodosOptions {
  search?: string;
  status?: TodoStatus;
  priority?: TodoPriority;
  dueFilter?: DueDateFilterType;
  sortBy?: SortFieldType;
  sortDirection?: SortDirectionType;
  clientToday?: string;
}

export interface ITodoRepository {
  findAllByListId(listId: string, options?: FindTodosOptions): Promise<Todo[]>;
  findById(id: string): Promise<Todo | null>;
  findListIdByTodoId(id: string): Promise<string | null>;
  create(
    data: {
      listId: string;
      title: string;
      description?: string | null;
      status?: TodoStatus;
      priority?: TodoPriority;
      dueDate?: string | null;
    },
    tx?: DbExecutor
  ): Promise<Todo>;
  updateStatus(id: string, status: TodoStatus, tx?: DbExecutor): Promise<Todo | null>;
  updateDetails(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      priority?: TodoPriority;
      dueDate?: string | null;
    },
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

  async findAllByListId(
    listId: string,
    options?: FindTodosOptions
  ): Promise<Todo[]> {
    const conditions = [eq(todos.listId, listId)];

    // 1. Text Search Filter (Title or Description)
    if (options?.search && options.search.trim().length > 0) {
      const searchPattern = `%${options.search.trim()}%`;
      conditions.push(
        or(
          ilike(todos.title, searchPattern),
          ilike(todos.description, searchPattern)
        )!
      );
    }

    // 2. Status Filter
    if (options?.status) {
      conditions.push(eq(todos.status, options.status));
    }

    // 3. Priority Filter
    if (options?.priority) {
      conditions.push(eq(todos.priority, options.priority));
    }

    // 4. Due Date Filter
    if (options?.dueFilter && options.dueFilter !== "ALL") {
      const today = options.clientToday || new Date().toISOString().slice(0, 10);

      switch (options.dueFilter) {
        case "OVERDUE":
          // Rule: Status != DONE and dueDate < today
          conditions.push(
            and(
              ne(todos.status, "DONE"),
              isNotNull(todos.dueDate),
              lt(todos.dueDate, today)
            )!
          );
          break;
        case "TODAY":
          conditions.push(
            and(isNotNull(todos.dueDate), eq(todos.dueDate, today))!
          );
          break;
        case "THIS_WEEK": {
          const weekEnd = addDaysToIsoDate(today, 7);
          conditions.push(
            and(
              isNotNull(todos.dueDate),
              gte(todos.dueDate, today),
              lte(todos.dueDate, weekEnd)
            )!
          );
          break;
        }
        case "NO_DUE_DATE":
          conditions.push(isNull(todos.dueDate));
          break;
      }
    }

    // 5. Deterministic Multi-Key Sorting
    const sortBy = options?.sortBy || "created";
    const sortDirection = options?.sortDirection || "desc";
    const isAsc = sortDirection === "asc";

    let orderExpressions = [];

    switch (sortBy) {
      case "dueDate":
        // Earliest or Latest first, NULL values always last, with created_at, id tiebreakers
        orderExpressions = isAsc
          ? [sql`${todos.dueDate} ASC NULLS LAST`, desc(todos.createdAt), desc(todos.id)]
          : [sql`${todos.dueDate} DESC NULLS LAST`, desc(todos.createdAt), desc(todos.id)];
        break;

      case "priority": {
        // Priority rank: URGENT(4), HIGH(3), MEDIUM(2), LOW(1)
        const priorityRank = sql`CASE ${todos.priority}
          WHEN 'URGENT' THEN 4
          WHEN 'HIGH' THEN 3
          WHEN 'MEDIUM' THEN 2
          WHEN 'LOW' THEN 1
          ELSE 0
        END`;
        orderExpressions = isAsc
          ? [asc(priorityRank), desc(todos.createdAt), desc(todos.id)]
          : [desc(priorityRank), desc(todos.createdAt), desc(todos.id)];
        break;
      }

      case "title":
        orderExpressions = isAsc
          ? [asc(todos.title), desc(todos.createdAt), desc(todos.id)]
          : [desc(todos.title), desc(todos.createdAt), desc(todos.id)];
        break;

      case "created":
      default:
        orderExpressions = isAsc
          ? [asc(todos.createdAt), asc(todos.id)]
          : [desc(todos.createdAt), desc(todos.id)];
        break;
    }

    return this.db
      .select()
      .from(todos)
      .where(and(...conditions))
      .orderBy(...orderExpressions);
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
      priority?: TodoPriority;
      dueDate?: string | null;
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
        priority: data.priority ?? "MEDIUM",
        dueDate: data.dueDate ?? null,
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
    data: {
      title?: string;
      description?: string | null;
      priority?: TodoPriority;
      dueDate?: string | null;
    },
    tx?: DbExecutor
  ): Promise<Todo | null> {
    const executor = tx ?? this.db;
    const updateSet: Partial<typeof todos.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.title !== undefined) updateSet.title = data.title;
    if (data.description !== undefined) updateSet.description = data.description;
    if (data.priority !== undefined) updateSet.priority = data.priority;
    if (data.dueDate !== undefined) updateSet.dueDate = data.dueDate;

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
