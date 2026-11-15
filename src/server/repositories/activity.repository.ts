import { sql } from "drizzle-orm";
import { db as defaultDb, type Database, type DbExecutor } from "@/db";
import {
  activityLogs,
  type ActivityLog,
  type NewActivityLog,
  type ActivityAction,
  type ActivityEntityType,
} from "@/db/schema/activities";

export interface ActivityLogWithActor {
  id: string;
  listId: string;
  actorId: string | null;
  actorEmail: string | null;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface IActivityRepository {
  create(data: NewActivityLog, tx?: DbExecutor): Promise<ActivityLog>;
  findByListId(
    listId: string,
    limit: number,
    cursor?: { createdAt: Date; id: string }
  ): Promise<ActivityLogWithActor[]>;
  deleteAllByListId(listId: string, tx?: DbExecutor): Promise<number>;
}

export class ActivityRepository implements IActivityRepository {
  private readonly db: Database;

  constructor(database: Database = defaultDb) {
    this.db = database;
  }

  async create(data: NewActivityLog, tx?: DbExecutor): Promise<ActivityLog> {
    const executor = tx ?? this.db;
    const [result] = await executor.insert(activityLogs).values(data).returning();
    return result;
  }

  async findByListId(
    listId: string,
    limit: number,
    cursor?: { createdAt: Date; id: string }
  ): Promise<ActivityLogWithActor[]> {
    const safeLimit = Math.min(Math.max(1, limit), 100);

    const query = cursor
      ? sql`
          SELECT 
            al.id,
            al.list_id AS "listId",
            al.actor_id AS "actorId",
            al.action,
            al.entity_type AS "entityType",
            al.entity_id AS "entityId",
            al.metadata,
            al.created_at AS "createdAt",
            u.email AS "actorEmail"
          FROM activity_logs al
          LEFT JOIN auth.users u ON u.id = al.actor_id
          WHERE al.list_id = ${listId}::uuid
            AND (
              al.created_at < ${cursor.createdAt.toISOString()}::timestamptz
              OR (
                al.created_at = ${cursor.createdAt.toISOString()}::timestamptz
                AND al.id < ${cursor.id}::uuid
              )
            )
          ORDER BY al.created_at DESC, al.id DESC
          LIMIT ${safeLimit + 1};
        `
      : sql`
          SELECT 
            al.id,
            al.list_id AS "listId",
            al.actor_id AS "actorId",
            al.action,
            al.entity_type AS "entityType",
            al.entity_id AS "entityId",
            al.metadata,
            al.created_at AS "createdAt",
            u.email AS "actorEmail"
          FROM activity_logs al
          LEFT JOIN auth.users u ON u.id = al.actor_id
          WHERE al.list_id = ${listId}::uuid
          ORDER BY al.created_at DESC, al.id DESC
          LIMIT ${safeLimit + 1};
        `;

    const rows = (await this.db.execute(query)) as unknown as Array<{
      id: string;
      listId: string;
      actorId: string | null;
      action: ActivityAction;
      entityType: ActivityEntityType;
      entityId: string | null;
      metadata: Record<string, unknown> | string;
      createdAt: string | Date;
      actorEmail: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      listId: row.listId,
      actorId: row.actorId,
      actorEmail: row.actorEmail,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata:
        typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata || {},
      createdAt: new Date(row.createdAt),
    }));
  }

  async deleteAllByListId(listId: string, tx?: DbExecutor): Promise<number> {
    const executor = tx ?? this.db;
    const result = await executor.execute(sql`
      DELETE FROM activity_logs WHERE list_id = ${listId}::uuid;
    `);
    return Number(result.count ?? 0);
  }
}

export const activityRepository = new ActivityRepository();

