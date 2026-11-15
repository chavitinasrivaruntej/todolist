import { sql } from "drizzle-orm";
import { db as defaultDb, type Database, type DbExecutor } from "@/db";
import {
  type INotificationRepository,
  notificationRepository as defaultNotificationRepo,
} from "@/server/repositories/notification.repository";
import {
  type Notification,
  type NotificationType,
} from "@/db/schema/notifications";

export interface GetNotificationsInput {
  limit?: number;
  cursor?: string;
}

export class NotificationService {
  private readonly notificationRepo: INotificationRepository;
  private readonly db: Database;

  constructor(
    notificationRepo: INotificationRepository = defaultNotificationRepo,
    database: Database = defaultDb
  ) {
    this.notificationRepo = notificationRepo;
    this.db = database;
  }

  /**
   * Looks up auth.users to find the UUID of a user by email.
   * Returns null if the user is not registered.
   */
  async findUserIdByEmail(email: string): Promise<string | null> {
    try {
      const rows = (await this.db.execute(sql`
        SELECT id FROM auth.users WHERE lower(email) = lower(${email.trim()}) LIMIT 1;
      `)) as unknown as Array<{ id: string }>;
      return rows[0]?.id ?? null;
    } catch (err) {
      console.error("[NotificationService.findUserIdByEmail]", err);
      return null;
    }
  }

  /**
   * Helper to safely persist a notification, logging any unexpected error
   * without bubbling up to disrupt the initiating domain transaction.
   */
  private async safeCreate(
    data: {
      userId: string;
      actorId?: string | null;
      listId?: string | null;
      type: NotificationType;
      title: string;
      message: string;
    },
    tx?: DbExecutor
  ): Promise<Notification | null> {
    // Suppress self-notifications
    if (data.actorId && data.actorId === data.userId) {
      return null;
    }

    try {
      return await this.notificationRepo.create(
        {
          userId: data.userId,
          actorId: data.actorId ?? null,
          listId: data.listId ?? null,
          type: data.type,
          title: data.title,
          message: data.message,
          isRead: false,
        },
        tx
      );
    } catch (err) {
      console.error("[NotificationDeliveryError]", {
        type: data.type,
        actorId: data.actorId,
        recipientUserId: data.userId,
        listId: data.listId,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      });
      return null;
    }
  }

  /**
   * 1. Notifies a registered invitee of a newly received invitation.
   * If the invitee is unregistered, skips notification cleanly.
   */
  async notifyInvitationReceived(
    params: {
      listId: string;
      listName: string;
      inviterId: string;
      inviterEmail: string;
      inviteeEmail: string;
      role: string;
    },
    tx?: DbExecutor
  ): Promise<Notification | null> {
    const inviteeUserId = await this.findUserIdByEmail(params.inviteeEmail);
    if (!inviteeUserId) {
      return null;
    }

    return this.safeCreate(
      {
        userId: inviteeUserId,
        actorId: params.inviterId,
        listId: params.listId,
        type: "INVITATION_RECEIVED",
        title: "New List Invitation",
        message: `${params.inviterEmail} invited you to collaborate on '${params.listName}' as ${params.role}.`,
      },
      tx
    );
  }

  /**
   * 2. Notifies the list owner when a collaborator accepts an invitation.
   */
  async notifyInvitationAccepted(
    params: {
      listId: string;
      listName: string;
      acceptorId: string;
      acceptorEmail: string;
      ownerId: string;
    },
    tx?: DbExecutor
  ): Promise<Notification | null> {
    return this.safeCreate(
      {
        userId: params.ownerId,
        actorId: params.acceptorId,
        listId: params.listId,
        type: "INVITATION_ACCEPTED",
        title: "Invitation Accepted",
        message: `${params.acceptorEmail} accepted your invitation to '${params.listName}'.`,
      },
      tx
    );
  }

  /**
   * 3. Notifies a collaborator that they were removed from a list.
   */
  async notifyMemberRemoved(
    params: {
      listId: string;
      listName: string;
      actorId: string;
      actorEmail: string;
      memberUserId: string;
    },
    tx?: DbExecutor
  ): Promise<Notification | null> {
    return this.safeCreate(
      {
        userId: params.memberUserId,
        actorId: params.actorId,
        listId: params.listId,
        type: "MEMBER_REMOVED",
        title: "Removed from List",
        message: `You were removed from the list '${params.listName}' by ${params.actorEmail}.`,
      },
      tx
    );
  }

  /**
   * 4. Notifies the list owner when a member leaves a shared list.
   */
  async notifyMemberLeft(
    params: {
      listId: string;
      listName: string;
      memberUserId: string;
      memberEmail: string;
      ownerId: string;
    },
    tx?: DbExecutor
  ): Promise<Notification | null> {
    return this.safeCreate(
      {
        userId: params.ownerId,
        actorId: params.memberUserId,
        listId: params.listId,
        type: "MEMBER_LEFT",
        title: "Member Left List",
        message: `${params.memberEmail} left the list '${params.listName}'.`,
      },
      tx
    );
  }

  /**
   * 5. Notifies a collaborator when their role is updated.
   */
  async notifyMemberRoleChanged(
    params: {
      listId: string;
      listName: string;
      actorId: string;
      actorEmail: string;
      memberUserId: string;
      newRole: string;
    },
    tx?: DbExecutor
  ): Promise<Notification | null> {
    return this.safeCreate(
      {
        userId: params.memberUserId,
        actorId: params.actorId,
        listId: params.listId,
        type: "MEMBER_ROLE_CHANGED",
        title: "Role Updated",
        message: `Your role on list '${params.listName}' was updated to ${params.newRole} by ${params.actorEmail}.`,
      },
      tx
    );
  }

  /**
   * 6. Notifies a registered invitee when an invitation is revoked.
   */
  async notifyInvitationRevoked(
    params: {
      listId: string;
      listName: string;
      actorId: string;
      actorEmail: string;
      inviteeEmail: string;
    },
    tx?: DbExecutor
  ): Promise<Notification | null> {
    const inviteeUserId = await this.findUserIdByEmail(params.inviteeEmail);
    if (!inviteeUserId) {
      return null;
    }

    return this.safeCreate(
      {
        userId: inviteeUserId,
        actorId: params.actorId,
        listId: params.listId,
        type: "INVITATION_REVOKED",
        title: "Invitation Revoked",
        message: `The invitation to '${params.listName}' was revoked by ${params.actorEmail}.`,
      },
      tx
    );
  }

  /**
   * Retrieves paginated notifications for the authenticated user inbox.
   */
  async getNotifications(
    userId: string,
    input: GetNotificationsInput
  ): Promise<{ items: Notification[]; nextCursor: string | null }> {
    const limit = input.limit ?? 20;
    const decodedCursor = input.cursor ? this.decodeCursor(input.cursor) : undefined;

    const rows = await this.notificationRepo.findPaginatedByUserId(
      userId,
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

    return { items, nextCursor };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.countUnreadByUserId(userId);
  }

  async markAsRead(id: string, userId: string): Promise<boolean> {
    return this.notificationRepo.markAsRead(id, userId);
  }

  async markAllAsRead(userId: string): Promise<number> {
    return this.notificationRepo.markAllAsRead(userId);
  }

  async deleteNotification(id: string, userId: string): Promise<boolean> {
    return this.notificationRepo.delete(id, userId);
  }

  encodeCursor(createdAt: Date, id: string): string {
    const payload = JSON.stringify({
      createdAt: createdAt.toISOString(),
      id,
    });
    return Buffer.from(payload).toString("base64url");
  }

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

export const notificationService = new NotificationService();

