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
  inArray,
} from "drizzle-orm";
import { db as defaultDb, type Database, type DbExecutor } from "@/db";
import {
  todos,
  type Todo,
  type TodoStatus,
  type TodoPriority,
} from "@/db/schema/todos";
import { todoTags, type Tag } from "@/db/schema/tags";
import { tagRepository, TagRepository, type ITagRepository } from "./tag.repository";
import {
  attachmentRepository as defaultAttachmentRepo,
  AttachmentRepository,
  type IAttachmentRepository,
} from "./attachment.repository";
import type {
  DueDateFilterType,
  SortFieldType,
  SortDirectionType,
} from "@/lib/validations/todo";

export type TodoWithTags = Todo & { tags: Tag[]; attachmentCount?: number };

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
  tagIds?: string[];
  tagOperator?: "AND" | "OR";
}

export interface ITodoRepository {
  findAllByListId(listId: string, options?: FindTodosOptions): Promise<TodoWithTags[]>;
  findById(id: string): Promise<TodoWithTags | null>;
  findListIdByTodoId(id: string): Promise<string | null>;
  create(
    data: {
      listId: string;
      title: string;
      description?: string | null;
      status?: TodoStatus;
      priority?: TodoPriority;
      dueDate?: string | null;
      recurrenceRuleId?: string | null;
      occurrenceNumber?: number | null;
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
  findByRecurrenceRuleAndOccurrence(
    recurrenceRuleId: string,
    occurrenceNumber: number,
    tx?: DbExecutor
  ): Promise<Todo | null>;
  findActiveOccurrenceByRuleId(
    recurrenceRuleId: string,
    tx?: DbExecutor
  ): Promise<Todo | null>;
  detachRecurrence(id: string, tx?: DbExecutor): Promise<Todo | null>;
}

/**
 * TodoRepository provides an abstracted data-access layer for the 'todos' table.
 */
export class TodoRepository implements ITodoRepository {
  private readonly db: Database;
  private readonly tagRepo?: ITagRepository;
  private readonly attachmentRepo?: IAttachmentRepository;

  constructor(
    database: Database = defaultDb,
    tagRepo?: ITagRepository,
    attachmentRepo?: IAttachmentRepository
  ) {
    this.db = database;
    this.tagRepo = tagRepo;
    this.attachmentRepo = attachmentRepo;
  }

  async findAllByListId(
    listId: string,
    options?: FindTodosOptions
  ): Promise<TodoWithTags[]> {
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

    // 5. Tag Filter (AND or OR semantics)
    if (options?.tagIds && options.tagIds.length > 0) {
      const tagIds = options.tagIds;
      if (options.tagOperator === "OR") {
        conditions.push(
          sql`${todos.id} IN (
            SELECT ${todoTags.todoId} FROM ${todoTags}
            WHERE ${inArray(todoTags.tagId, tagIds)}
          )`
        );
      } else {
        // Default "AND": task must possess ALL selected tags
        conditions.push(
          sql`${todos.id} IN (
            SELECT ${todoTags.todoId} FROM ${todoTags}
            WHERE ${inArray(todoTags.tagId, tagIds)}
            GROUP BY ${todoTags.todoId}
            HAVING COUNT(DISTINCT ${todoTags.tagId}) = ${tagIds.length}
          )`
        );
      }
    }

    // 6. Deterministic Multi-Key Sorting
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

    const rows = await this.db
      .select()
      .from(todos)
      .where(and(...conditions))
      .orderBy(...orderExpressions);

    if (rows.length === 0) return [];

    const todoIds = rows.map((r) => r.id);
    let tagsMap = new Map<string, Tag[]>();
    let attachmentCountsMap = new Map<string, number>();

    if (process.env.DATABASE_URL) {
      try {
        const tagRepoToUse =
          this.tagRepo || (this.db === defaultDb ? tagRepository : new TagRepository(this.db));
        tagsMap = await tagRepoToUse.findTagsForTodos(todoIds);
      } catch {
        // Fallback for mock environments
      }

      try {
        const attachmentRepoToUse =
          this.attachmentRepo ||
          (this.db === defaultDb ? defaultAttachmentRepo : new AttachmentRepository(this.db));
        attachmentCountsMap = await attachmentRepoToUse.getAttachmentCountsForTodos(todoIds);
      } catch {
        // Fallback for mock environments
      }
    }

    return rows.map((r) => ({
      ...r,
      tags: tagsMap.get(r.id) || [],
      attachmentCount: attachmentCountsMap.get(r.id) || 0,
    }));
  }

  async findById(id: string): Promise<TodoWithTags | null> {
    const [result] = await this.db
      .select()
      .from(todos)
      .where(eq(todos.id, id))
      .limit(1);

    if (!result) return null;
    let tags: Tag[] = [];
    let attachmentCount = 0;

    if (process.env.DATABASE_URL) {
      try {
        const tagRepoToUse =
          this.tagRepo || (this.db === defaultDb ? tagRepository : new TagRepository(this.db));
        tags = await tagRepoToUse.findTagsForTodo(id);
      } catch {
        // Fallback for mock environments
      }

      try {
        const attachmentRepoToUse =
          this.attachmentRepo ||
          (this.db === defaultDb ? defaultAttachmentRepo : new AttachmentRepository(this.db));
        const countsMap = await attachmentRepoToUse.getAttachmentCountsForTodos([id]);
        attachmentCount = countsMap.get(id) || 0;
      } catch {
        // Fallback for mock environments
      }
    }
    return { ...result, tags, attachmentCount };
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
      recurrenceRuleId?: string | null;
      occurrenceNumber?: number | null;
    },
    tx?: DbExecutor
  ): Promise<Todo> {
    const executor = tx ?? this.db;
    const values: typeof todos.$inferInsert = {
      listId: data.listId,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? "TODO",
      priority: data.priority ?? "MEDIUM",
      dueDate: data.dueDate ?? null,
      recurrenceRuleId: data.recurrenceRuleId ?? null,
      occurrenceNumber: data.occurrenceNumber ?? null,
    };

    const [created] = await executor
      .insert(todos)
      .values(values)
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

  async findByRecurrenceRuleAndOccurrence(
    recurrenceRuleId: string,
    occurrenceNumber: number,
    tx?: DbExecutor
  ): Promise<Todo | null> {
    const executor = tx ?? this.db;
    const [found] = await executor
      .select()
      .from(todos)
      .where(
        and(
          eq(todos.recurrenceRuleId, recurrenceRuleId),
          eq(todos.occurrenceNumber, occurrenceNumber)
        )
      )
      .limit(1);

    return found ?? null;
  }

  async findActiveOccurrenceByRuleId(
    recurrenceRuleId: string,
    tx?: DbExecutor
  ): Promise<Todo | null> {
    const executor = tx ?? this.db;
    const [active] = await executor
      .select()
      .from(todos)
      .where(
        and(
          eq(todos.recurrenceRuleId, recurrenceRuleId),
          ne(todos.status, "DONE")
        )
      )
      .orderBy(desc(todos.occurrenceNumber))
      .limit(1);

    return active ?? null;
  }

  async detachRecurrence(id: string, tx?: DbExecutor): Promise<Todo | null> {
    const executor = tx ?? this.db;
    const [updated] = await executor
      .update(todos)
      .set({
        recurrenceRuleId: null,
        occurrenceNumber: null,
        updatedAt: new Date(),
      })
      .where(eq(todos.id, id))
      .returning();

    return updated ?? null;
  }
}

export const todoRepository = new TodoRepository();
