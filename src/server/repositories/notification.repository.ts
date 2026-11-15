import { eq, and, sql } from "drizzle-orm";
import { db as defaultDb, type Database, type DbExecutor } from "@/db";
import {
  notifications,
  type Notification,
  type NewNotification,
} from "@/db/schema/notifications";

export interface INotificationRepository {
  create(data: NewNotification, tx?: DbExecutor): Promise<Notification>;
  findPaginatedByUserId(
    userId: string,
    limit: number,
    cursor?: { createdAt: Date; id: string }
  ): Promise<Notification[]>;
  countUnreadByUserId(userId: string): Promise<number>;
  markAsRead(id: string, userId: string, tx?: DbExecutor): Promise<boolean>;
  markAllAsRead(userId: string, tx?: DbExecutor): Promise<number>;
  delete(id: string, userId: string, tx?: DbExecutor): Promise<boolean>;
}

export class NotificationRepository implements INotificationRepository {
  private readonly db: Database;

  constructor(database: Database = defaultDb) {
    this.db = database;
  }

  async create(data: NewNotification, tx?: DbExecutor): Promise<Notification> {
    const executor = tx ?? this.db;
    const [result] = await executor.insert(notifications).values(data).returning();
    if (!result) {
      throw new Error("Failed to insert notification record.");
    }
    return result;
  }

  async findPaginatedByUserId(
    userId: string,
    limit: number,
    cursor?: { createdAt: Date; id: string }
  ): Promise<Notification[]> {
    const safeLimit = Math.min(Math.max(1, limit), 50);

    const query = cursor
      ? sql`
          SELECT 
            id,
            user_id AS "userId",
            actor_id AS "actorId",
            list_id AS "listId",
            type,
            title,
            message,
            is_read AS "isRead",
            created_at AS "createdAt"
          FROM notifications
          WHERE user_id = ${userId}::uuid
            AND (
              created_at < ${cursor.createdAt.toISOString()}::timestamptz
              OR (
                created_at = ${cursor.createdAt.toISOString()}::timestamptz
                AND id < ${cursor.id}::uuid
              )
            )
          ORDER BY created_at DESC, id DESC
          LIMIT ${safeLimit + 1};
        `
      : sql`
          SELECT 
            id,
            user_id AS "userId",
            actor_id AS "actorId",
            list_id AS "listId",
            type,
            title,
            message,
            is_read AS "isRead",
            created_at AS "createdAt"
          FROM notifications
          WHERE user_id = ${userId}::uuid
          ORDER BY created_at DESC, id DESC
          LIMIT ${safeLimit + 1};
        `;

    const rows = (await this.db.execute(query)) as unknown as Array<{
      id: string;
      userId: string;
      actorId: string | null;
      listId: string | null;
      type: string;
      title: string;
      message: string;
      isRead: boolean;
      createdAt: string | Date;
    }>;

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      actorId: r.actorId,
      listId: r.listId,
      type: r.type as any,
      title: r.title,
      message: r.message,
      isRead: r.isRead,
      createdAt: new Date(r.createdAt),
    }));
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    const [row] = (await this.db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM notifications
      WHERE user_id = ${userId}::uuid AND is_read = false;
    `)) as unknown as Array<{ count: number }>;

    return row?.count ?? 0;
  }

  async markAsRead(id: string, userId: string, tx?: DbExecutor): Promise<boolean> {
    const executor = tx ?? this.db;
    const updated = await executor
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning({ id: notifications.id });

    return updated.length > 0;
  }

  async markAllAsRead(userId: string, tx?: DbExecutor): Promise<number> {
    const executor = tx ?? this.db;
    const updated = await executor
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .returning({ id: notifications.id });

    return updated.length;
  }

  async delete(id: string, userId: string, tx?: DbExecutor): Promise<boolean> {
    const executor = tx ?? this.db;
    const deleted = await executor
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning({ id: notifications.id });

    return deleted.length > 0;
  }
}

export const notificationRepository = new NotificationRepository();

