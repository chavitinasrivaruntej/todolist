import {
  type IActivityRepository,
  type ActivityLogWithActor,
  activityRepository as defaultActivityRepo,
} from "@/server/repositories/activity.repository";
import {
  ListPermissionService,
  listPermissionService as defaultPermissionService,
} from "@/server/services/list-permission.service";
import {
  type ActivityAction,
  type ActivityEntityType,
  type ActivityLog,
} from "@/db/schema/activities";
import { type DbExecutor } from "@/db";

export interface LogActivityInput {
  listId: string;
  actorId?: string | null;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface GetActivityInput {
  listId: string;
  cursor?: string;
  limit?: number;
}

export class ActivityService {
  private readonly activityRepo: IActivityRepository;
  private readonly permissionService: ListPermissionService;

  constructor(
    activityRepo: IActivityRepository = defaultActivityRepo,
    permissionService: ListPermissionService = defaultPermissionService
  ) {
    this.activityRepo = activityRepo;
    this.permissionService = permissionService;
  }

  /**
   * Logs a new activity event. Can participate in an ongoing transaction via `tx`.
   * In environments without a configured database (e.g. unit tests), gracefully skips.
   */
  async logActivity(input: LogActivityInput, tx?: DbExecutor): Promise<ActivityLog | null> {
    try {
      if (!process.env.DATABASE_URL && !tx) {
        return null;
      }

      return await this.activityRepo.create(
        {
          listId: input.listId,
          actorId: input.actorId ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          metadata: input.metadata ?? {},
        },
        tx
      );
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === "DatabaseConfigurationError") {
        return null;
      }
      throw err;
    }
  }

  /**
   * Retrieves chronologically ordered activity logs for a list using composite keyset pagination.
   * Gated strictly by list read permissions (OWNER, EDITOR, VIEWER).
   */
  async getActivityByList(
    input: GetActivityInput,
    userId: string
  ): Promise<{ items: ActivityLogWithActor[]; nextCursor: string | null }> {
    await this.permissionService.requireCanReadList(userId, input.listId);

    const limit = input.limit ?? 20;
    const decodedCursor = input.cursor ? this.decodeCursor(input.cursor) : undefined;

    const rows = await this.activityRepo.findByListId(
      input.listId,
      limit,
      decodedCursor
    );

    let nextCursor: string | null = null;
    let items = rows;

    if (rows.length > limit) {
      items = rows.slice(0, limit);
      const lastItem = items[items.length - 1];
      if (lastItem) {
        nextCursor = this.encodeCursor(lastItem.createdAt, lastItem.id);
      }
    }

    return {
      items,
      nextCursor,
    };
  }

  /**
   * Encodes a composite (createdAt + id) cursor to a URL-safe base64 string.
   */
  encodeCursor(createdAt: Date, id: string): string {
    const payload = JSON.stringify({
      createdAt: createdAt.toISOString(),
      id,
    });
    return Buffer.from(payload).toString("base64url");
  }

  /**
   * Decodes and validates a composite cursor string.
   */
  decodeCursor(cursor: string): { createdAt: Date; id: string } | undefined {
    try {
      const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
      const parsed = JSON.parse(decoded);
      if (
        typeof parsed.createdAt === "string" &&
        typeof parsed.id === "string"
      ) {
        const date = new Date(parsed.createdAt);
        if (!isNaN(date.getTime())) {
          return { createdAt: date, id: parsed.id };
        }
      }
      return undefined;
    } catch {
      return undefined;
    }
  }
}

export const activityService = new ActivityService();
