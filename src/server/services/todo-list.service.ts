import { eq, sql } from "drizzle-orm";
import {
  type ITodoListRepository,
  type TodoListWithTaskCount,
  todoListRepository as defaultRepository,
} from "@/server/repositories/todo-list.repository";
import {
  type IListMemberRepository,
  listMemberRepository as defaultMemberRepository,
} from "@/server/repositories/list-member.repository";
import {
  ListPermissionService,
  listPermissionService as defaultPermissionService,
} from "@/server/services/list-permission.service";
import {
  ActivityService,
  activityService as defaultActivityService,
} from "@/server/services/activity.service";
import {
  NotificationService,
  notificationService as defaultNotificationService,
} from "@/server/services/notification.service";
import { withTransaction } from "@/server/utils/transaction";
import { db as defaultDb, type Database } from "@/db";
import {
  type CreateTodoListInput,
  type RenameTodoListInput,
  type DeleteTodoListInput,
} from "@/lib/validations/list";
import { type TodoList } from "@/db/schema/lists";
import { NotFoundError, ValidationError } from "@/server/errors";

/**
 * TodoListService encapsulates domain logic and business rules for Todo Lists.
 * Enforces ownership invariants, role-based permissions, and safe deletion policies.
 */
export class TodoListService {
  private readonly repository: ITodoListRepository;
  private readonly memberRepository: IListMemberRepository;
  private readonly permissionService: ListPermissionService;
  private readonly activityService: ActivityService;
  private readonly notificationService: NotificationService;
  private readonly db: Database;

  constructor(
    repository: ITodoListRepository = defaultRepository,
    memberRepository: IListMemberRepository = defaultMemberRepository,
    permissionService: ListPermissionService = defaultPermissionService,
    activityService: ActivityService = defaultActivityService,
    notificationService: NotificationService = defaultNotificationService,
    database: Database = defaultDb
  ) {
    this.repository = repository;
    this.memberRepository = memberRepository;
    this.permissionService = permissionService;
    this.activityService = activityService;
    this.notificationService = notificationService;
    this.db = database;
  }

  /**
   * Returns all lists (both owned and shared) accessible to the authenticated user.
   * If a user has zero lists total, provisions an initial "Personal" workspace.
   */
  async getLists(userId: string): Promise<TodoListWithTaskCount[]> {
    const lists = await this.repository.findAllWithTaskCounts(userId);
    if (lists.length === 0) {
      const defaultList = await this.createList({ name: "Personal" }, userId);
      return [{ ...defaultList, taskCount: 0, effectiveRole: "OWNER" }];
    }
    return lists;
  }

  /**
   * Returns only lists owned by the user.
   */
  async getOwnedLists(userId: string): Promise<TodoListWithTaskCount[]> {
    return this.repository.findOwnedWithTaskCounts(userId);
  }

  /**
   * Returns lists shared with the user by others.
   */
  async getSharedLists(userId: string): Promise<TodoListWithTaskCount[]> {
    return this.repository.findSharedWithTaskCounts(userId);
  }

  /**
   * Creates a new todo list owned by the authenticated user atomically with its activity log.
   */
  async createList(input: CreateTodoListInput, userId: string): Promise<TodoList> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new ValidationError("List name cannot be empty or solely whitespace.");
    }

    return withTransaction(this.db, async (tx) => {
      const listData = {
        name: trimmedName,
        userId,
      };

      const created = tx
        ? await this.repository.create(listData, tx)
        : await this.repository.create(listData);

      await this.activityService.logActivity(
        {
          listId: created.id,
          actorId: userId,
          action: "LIST_CREATED",
          entityType: "LIST",
          entityId: created.id,
          metadata: { name: created.name },
        },
        tx
      );

      return created;
    });
  }

  /**
   * Renames an existing todo list atomically with its activity log.
   * Only the OWNER of the list has permission to rename it.
   */
  async renameList(input: RenameTodoListInput, userId: string): Promise<TodoList> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new ValidationError("List name cannot be empty or solely whitespace.");
    }

    await this.permissionService.requireOwner(userId, input.id);

    return withTransaction(this.db, async (tx) => {
      const updated = tx
        ? await this.repository.updateName(input.id, trimmedName, tx)
        : await this.repository.updateName(input.id, trimmedName);

      if (!updated) {
        throw new NotFoundError(`Failed to update todo list with ID ${input.id}.`);
      }

      await this.activityService.logActivity(
        {
          listId: updated.id,
          actorId: userId,
          action: "LIST_RENAMED",
          entityType: "LIST",
          entityId: updated.id,
          metadata: {
            newName: updated.name,
          },
        },
        tx
      );

      return updated;
    });
  }

  /**
   * Deletes a todo list according to the safe deletion policy.
   * All associated activity logs are cleanly cascaded and deleted by PostgreSQL.
   * Only the OWNER of the list has permission to delete it.
   */
  async deleteList(
    input: DeleteTodoListInput,
    userId: string
  ): Promise<{ success: boolean; id: string }> {
    await this.permissionService.requireOwner(userId, input.id);

    const existing = await this.repository.findById(input.id);
    if (!existing) {
      throw new NotFoundError(`Todo list with ID ${input.id} was not found.`);
    }

    const taskCount = await this.repository.countTasksByListId(input.id);
    if (taskCount > 0 && !input.force) {
      throw new ValidationError(
        `Cannot delete list '${existing.name}' because it contains ${taskCount} task(s). Please empty the list or confirm deletion with force=true.`
      );
    }

    const deleted = await this.repository.delete(input.id);
    if (!deleted) {
      throw new NotFoundError(`Todo list with ID ${input.id} was not found.`);
    }

    return { success: true, id: input.id };
  }

  /**
   * Allows a collaborator to leave a shared list (removes their membership),
   * records a MEMBER_LEFT activity log, and notifies the list owner.
   */
  async leaveList(
    input: { listId: string },
    userId: string
  ): Promise<{ success: boolean; listId: string }> {
    const role = await this.permissionService.getUserRole(userId, input.listId);
    if (!role) {
      throw new NotFoundError(`Todo list with ID ${input.listId} was not found.`);
    }

    if (role === "OWNER") {
      throw new ValidationError(
        "List owners cannot leave their own list. You must delete the list instead."
      );
    }

    const removed = await this.memberRepository.deleteByListAndUser(input.listId, userId);
    if (!removed) {
      throw new NotFoundError(`Membership on list ${input.listId} was not found.`);
    }

    await this.activityService.logActivity({
      listId: input.listId,
      actorId: userId,
      action: "MEMBER_LEFT",
      entityType: "MEMBER",
      metadata: { userId },
    });

    try {
      const existingList = await this.repository.findById(input.listId);
      if (existingList && existingList.userId) {
        let memberEmail = "Collaborator";
        if (process.env.DATABASE_URL) {
          const rows = (await this.db.execute(sql`
            SELECT email FROM auth.users WHERE id = ${userId}::uuid LIMIT 1;
          `)) as unknown as Array<{ email: string }>;
          if (rows[0]?.email) memberEmail = rows[0].email;
        }

        await this.notificationService.notifyMemberLeft({
          listId: input.listId,
          listName: existingList.name,
          memberUserId: userId,
          memberEmail,
          ownerId: existingList.userId,
        });
      }
    } catch {
      // In mock/test environments where db query fails, continue gracefully
    }

    return { success: true, listId: input.listId };
  }
}

export const todoListService = new TodoListService();
