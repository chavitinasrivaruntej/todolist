import { eq, and, sql, desc, inArray, or, gt } from "drizzle-orm";
import { db as defaultDb, type Database, type DbExecutor } from "@/db";
import {
  todoAttachments,
  type TodoAttachment,
  type NewTodoAttachment,
  type AttachmentStatus,
} from "@/db/schema/attachments";
import { todos } from "@/db/schema/todos";

export interface CreateReservationInput {
  todoId: string;
  listId: string;
  storagePath: string;
  originalFilename: string;
  sanitizedFilename: string;
  mimeType: string;
  fileSize: number;
  uploadedBy?: string | null;
  expiresAt: Date;
}

export interface IAttachmentRepository {
  reserveUploadSlot(
    data: CreateReservationInput,
    maxLimit: number,
    tx?: DbExecutor
  ): Promise<TodoAttachment>;
  findById(id: string, tx?: DbExecutor): Promise<TodoAttachment | null>;
  findByStoragePath(storagePath: string, tx?: DbExecutor): Promise<TodoAttachment | null>;
  findActiveByTodoId(todoId: string, tx?: DbExecutor): Promise<TodoAttachment[]>;
  findStoragePathsByTodoId(todoId: string, tx?: DbExecutor): Promise<string[]>;
  countActiveAndPendingByTodoId(todoId: string, tx?: DbExecutor): Promise<number>;
  getAttachmentCountsForTodos(todoIds: string[], tx?: DbExecutor): Promise<Map<string, number>>;
  markActive(id: string, tx?: DbExecutor): Promise<TodoAttachment | null>;
  markPendingDeletion(id: string, tx?: DbExecutor): Promise<TodoAttachment | null>;
  hardDelete(id: string, tx?: DbExecutor): Promise<boolean>;
  findExpiredReservations(cutoff: Date, tx?: DbExecutor): Promise<TodoAttachment[]>;
  findPendingDeletions(cutoff: Date, tx?: DbExecutor): Promise<TodoAttachment[]>;
}

export class AttachmentRepository implements IAttachmentRepository {
  private readonly db: Database;

  constructor(database: Database = defaultDb) {
    this.db = database;
  }

  private getExecutor(tx?: DbExecutor): DbExecutor {
    return tx || this.db;
  }

  /**
   * Atomically acquires a row lock on the parent task, counts active + unexpired pending slots,
   * verifies the max limit, and inserts the PENDING_UPLOAD reservation row.
   */
  async reserveUploadSlot(
    data: CreateReservationInput,
    maxLimit: number,
    tx?: DbExecutor
  ): Promise<TodoAttachment> {
    const executor = this.getExecutor(tx);

    // 1. Acquire row lock on parent task to serialize concurrent upload reservations
    await executor
      .select({ id: todos.id })
      .from(todos)
      .where(eq(todos.id, data.todoId))
      .for("update")
      .limit(1);

    // 2. Count existing active slots + valid unexpired pending slots
    const now = new Date();
    const [countResult] = await executor
      .select({ count: sql<number>`count(*)::int` })
      .from(todoAttachments)
      .where(
        and(
          eq(todoAttachments.todoId, data.todoId),
          or(
            eq(todoAttachments.status, "ACTIVE"),
            and(
              eq(todoAttachments.status, "PENDING_UPLOAD"),
              gt(todoAttachments.expiresAt, now)
            )
          )
        )
      );

    const currentCount = countResult?.count ?? 0;
    if (currentCount >= maxLimit) {
      throw new Error(`TASK_ATTACHMENT_LIMIT_EXCEEDED`);
    }

    // 3. Insert reservation record
    const [created] = await executor
      .insert(todoAttachments)
      .values({
        todoId: data.todoId,
        listId: data.listId,
        storagePath: data.storagePath,
        originalFilename: data.originalFilename,
        sanitizedFilename: data.sanitizedFilename,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        uploadedBy: data.uploadedBy ?? null,
        status: "PENDING_UPLOAD",
        expiresAt: data.expiresAt,
      })
      .returning();

    return created!;
  }

  async findById(id: string, tx?: DbExecutor): Promise<TodoAttachment | null> {
    const executor = this.getExecutor(tx);
    const [attachment] = await executor
      .select()
      .from(todoAttachments)
      .where(eq(todoAttachments.id, id))
      .limit(1);

    return attachment || null;
  }

  async findByStoragePath(storagePath: string, tx?: DbExecutor): Promise<TodoAttachment | null> {
    const executor = this.getExecutor(tx);
    const [attachment] = await executor
      .select()
      .from(todoAttachments)
      .where(eq(todoAttachments.storagePath, storagePath))
      .limit(1);

    return attachment || null;
  }

  async findActiveByTodoId(todoId: string, tx?: DbExecutor): Promise<TodoAttachment[]> {
    const executor = this.getExecutor(tx);
    return executor
      .select()
      .from(todoAttachments)
      .where(
        and(
          eq(todoAttachments.todoId, todoId),
          eq(todoAttachments.status, "ACTIVE")
        )
      )
      .orderBy(desc(todoAttachments.createdAt));
  }

  async findStoragePathsByTodoId(todoId: string, tx?: DbExecutor): Promise<string[]> {
    const executor = this.getExecutor(tx);
    const rows = await executor
      .select({ storagePath: todoAttachments.storagePath })
      .from(todoAttachments)
      .where(eq(todoAttachments.todoId, todoId));

    return rows.map((r) => r.storagePath);
  }

  async countActiveAndPendingByTodoId(todoId: string, tx?: DbExecutor): Promise<number> {
    const executor = this.getExecutor(tx);
    const now = new Date();
    const [result] = await executor
      .select({ count: sql<number>`count(*)::int` })
      .from(todoAttachments)
      .where(
        and(
          eq(todoAttachments.todoId, todoId),
          or(
            eq(todoAttachments.status, "ACTIVE"),
            and(
              eq(todoAttachments.status, "PENDING_UPLOAD"),
              gt(todoAttachments.expiresAt, now)
            )
          )
        )
      );

    return result?.count ?? 0;
  }

  /**
   * Batch counts active attachments for multiple todos in a single grouped query (avoids N+1).
   */
  async getAttachmentCountsForTodos(
    todoIds: string[],
    tx?: DbExecutor
  ): Promise<Map<string, number>> {
    const countsMap = new Map<string, number>();
    if (todoIds.length === 0) return countsMap;

    const executor = this.getExecutor(tx);
    const rows = await executor
      .select({
        todoId: todoAttachments.todoId,
        count: sql<number>`count(*)::int`,
      })
      .from(todoAttachments)
      .where(
        and(
          inArray(todoAttachments.todoId, todoIds),
          eq(todoAttachments.status, "ACTIVE")
        )
      )
      .groupBy(todoAttachments.todoId);

    for (const row of rows) {
      countsMap.set(row.todoId, row.count);
    }
    return countsMap;
  }

  async markActive(id: string, tx?: DbExecutor): Promise<TodoAttachment | null> {
    const executor = this.getExecutor(tx);
    const [updated] = await executor
      .update(todoAttachments)
      .set({
        status: "ACTIVE",
        expiresAt: null,
      })
      .where(eq(todoAttachments.id, id))
      .returning();

    return updated || null;
  }

  async markPendingDeletion(id: string, tx?: DbExecutor): Promise<TodoAttachment | null> {
    const executor = this.getExecutor(tx);
    const [updated] = await executor
      .update(todoAttachments)
      .set({
        status: "PENDING_DELETION",
        deletedAt: new Date(),
      })
      .where(
        and(
          eq(todoAttachments.id, id),
          eq(todoAttachments.status, "ACTIVE")
        )
      )
      .returning();

    return updated || null;
  }

  async hardDelete(id: string, tx?: DbExecutor): Promise<boolean> {
    const executor = this.getExecutor(tx);
    const [deleted] = await executor
      .delete(todoAttachments)
      .where(eq(todoAttachments.id, id))
      .returning({ id: todoAttachments.id });

    return !!deleted;
  }

  async findExpiredReservations(cutoff: Date, tx?: DbExecutor): Promise<TodoAttachment[]> {
    const executor = this.getExecutor(tx);
    return executor
      .select()
      .from(todoAttachments)
      .where(
        and(
          eq(todoAttachments.status, "PENDING_UPLOAD"),
          sql`${todoAttachments.expiresAt} < ${cutoff}`
        )
      );
  }

  async findPendingDeletions(cutoff: Date, tx?: DbExecutor): Promise<TodoAttachment[]> {
    const executor = this.getExecutor(tx);
    return executor
      .select()
      .from(todoAttachments)
      .where(
        and(
          eq(todoAttachments.status, "PENDING_DELETION"),
          sql`${todoAttachments.deletedAt} < ${cutoff}`
        )
      );
  }
}

export const attachmentRepository = new AttachmentRepository();
