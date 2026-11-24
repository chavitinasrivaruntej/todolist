import {
  type ITodoRepository,
  type TodoWithTags,
  todoRepository as defaultRepository,
} from "@/server/repositories/todo.repository";
import {
  type ITagRepository,
  tagRepository as defaultTagRepo,
} from "@/server/repositories/tag.repository";
import {
  type IAttachmentRepository,
  attachmentRepository as defaultAttachmentRepo,
} from "@/server/repositories/attachment.repository";
import {
  type ISupabaseStorageAdapter,
  supabaseStorageAdapter as defaultStorageAdapter,
} from "@/lib/storage/supabase-storage";
import {
  type IRealtimePublisherService,
  realtimePublisherService as defaultRealtimePublisher,
} from "@/server/services/realtime-publisher.service";
import {
  RecurrenceService,
  recurrenceService as defaultRecurrenceService,
} from "@/server/services/recurrence.service";
import {
  ListPermissionService,
  listPermissionService as defaultPermissionService,
} from "@/server/services/list-permission.service";
import {
  ActivityService,
  activityService as defaultActivityService,
} from "@/server/services/activity.service";
import { withTransaction } from "@/server/utils/transaction";
import { db as defaultDb, type Database } from "@/db";
import {
  type DeleteTodoInput,
  type GetTodosByListInput,
  type UpdateTodoStatusInput,
} from "@/lib/validations/todo";
import { type Todo, type TodoStatus, type TodoPriority } from "@/db/schema/todos";
import { type Tag } from "@/db/schema/tags";
import { NotFoundError, ValidationError } from "@/server/errors";

export interface CreateTodoServiceInput {
  listId: string;
  title: string;
  description?: string | null;
  status?: TodoStatus;
  priority?: TodoPriority;
  dueDate?: string | null;
  tagIds?: string[];
  recurrenceRuleId?: string | null;
  occurrenceNumber?: number | null;
  clientSessionId?: string | null;
}

export interface UpdateTodoDetailsServiceInput {
  id: string;
  title?: string;
  description?: string | null;
  priority?: TodoPriority;
  dueDate?: string | null;
  tagIds?: string[];
  clientSessionId?: string | null;
}

/**
 * TodoService encapsulates domain rules and business logic for Todo operations.
 * Enforces role-based permissions (OWNER, EDITOR, VIEWER) and records immutable activity logs.
 */
export class TodoService {
  private readonly repository: ITodoRepository;
  private readonly tagRepository: ITagRepository;
  private readonly permissionService: ListPermissionService;
  private readonly activityService: ActivityService;
  private readonly recurrenceService: RecurrenceService;
  private readonly attachmentRepository: IAttachmentRepository;
  private readonly storageAdapter: ISupabaseStorageAdapter;
  private readonly realtimePublisher: IRealtimePublisherService;
  private readonly db: Database;

  constructor(
    repository: ITodoRepository = defaultRepository,
    permissionService: ListPermissionService = defaultPermissionService,
    activityService: ActivityService = defaultActivityService,
    database: Database = defaultDb,
    tagRepository: ITagRepository = defaultTagRepo,
    recurrenceService: RecurrenceService = defaultRecurrenceService,
    attachmentRepository: IAttachmentRepository = defaultAttachmentRepo,
    storageAdapter: ISupabaseStorageAdapter = defaultStorageAdapter,
    realtimePublisher: IRealtimePublisherService = defaultRealtimePublisher
  ) {
    this.repository = repository;
    this.permissionService = permissionService;
    this.activityService = activityService;
    this.db = database;
    this.tagRepository = tagRepository;
    this.recurrenceService = recurrenceService;
    this.attachmentRepository = attachmentRepository;
    this.storageAdapter = storageAdapter;
    this.realtimePublisher = realtimePublisher;
  }

  /**
   * Retrieves todo items belonging to a specific list.
   * Allowed for OWNER, EDITOR, and VIEWER roles.
   * Supports search, status, priority, due date filtering, tag filtering, and deterministic multi-key sorting.
   */
  async getTodosByList(
    input: GetTodosByListInput,
    userId: string
  ): Promise<TodoWithTags[]> {
    await this.permissionService.requireCanReadList(userId, input.listId);
    return this.repository.findAllByListId(input.listId, {
      search: input.search,
      status: input.status,
      priority: input.priority,
      dueFilter: input.dueFilter ?? "ALL",
      sortBy: input.sortBy ?? "created",
      sortDirection: input.sortDirection ?? "desc",
      clientToday: input.clientToday,
      tagIds: input.tagIds,
      tagOperator: input.tagOperator ?? "AND",
    });
  }

  /**
   * Creates a new todo item within a list atomically with its tags and activity log.
   * Allowed for OWNER and EDITOR roles. Blocked for VIEWER roles.
   */
  async createTodo(
    input: CreateTodoServiceInput,
    userId: string
  ): Promise<TodoWithTags> {
    const trimmedTitle = input.title.trim();
    if (!trimmedTitle) {
      throw new ValidationError(
        "Todo title cannot be empty or solely whitespace."
      );
    }

    await this.permissionService.requireCanMutateTodos(userId, input.listId);

    // Verify all specified tags belong to this list
    let assignedTags: Tag[] = [];
    if (input.tagIds && input.tagIds.length > 0) {
      const verified = await this.tagRepository.findByIdsAndListId(
        input.tagIds,
        input.listId
      );
      if (verified.length !== input.tagIds.length) {
        throw new ValidationError("One or more selected tags do not belong to this list.");
      }
      assignedTags = verified;
    }

    const result = await withTransaction(this.db, async (tx) => {
      const todoData: Parameters<typeof this.repository.create>[0] = {
        listId: input.listId,
        title: trimmedTitle,
        description: input.description ?? null,
        status: input.status ?? "TODO",
        priority: input.priority ?? "MEDIUM",
        dueDate: input.dueDate ?? null,
      };
      if (input.recurrenceRuleId !== undefined) {
        todoData.recurrenceRuleId = input.recurrenceRuleId;
      }
      if (input.occurrenceNumber !== undefined) {
        todoData.occurrenceNumber = input.occurrenceNumber;
      }

      const created = tx
        ? await this.repository.create(todoData, tx)
        : await this.repository.create(todoData);

      if (input.tagIds && input.tagIds.length > 0) {
        await this.tagRepository.assignTagsToTodo(created.id, input.tagIds, tx);
      }

      await this.activityService.logActivity(
        {
          listId: input.listId,
          actorId: userId,
          action: "TODO_CREATED",
          entityType: "TODO",
          entityId: created.id,
          metadata: {
            title: created.title,
            status: created.status,
            priority: created.priority,
            dueDate: created.dueDate ?? null,
            tagCount: input.tagIds?.length || 0,
          },
        },
        tx
      );

      return {
        ...created,
        tags: assignedTags,
      };
    });

    // Broadcast TASK_CREATED event post-commit
    try {
      await this.realtimePublisher.publishTaskCreated(
        input.listId,
        userId,
        input.clientSessionId ?? null,
        result
      );
    } catch {
      // Handled silently inside publisher
    }

    return result;
  }

  /**
   * Updates the status of an existing Todo item atomically with its activity log.
   * Allowed for OWNER and EDITOR roles. Blocked for VIEWER roles.
   */
  async updateStatus(
    input: UpdateTodoStatusInput,
    userId: string
  ): Promise<TodoWithTags> {
    const listId = await this.repository.findListIdByTodoId(input.id);
    if (!listId) {
      throw new NotFoundError(`Todo with ID ${input.id} was not found.`);
    }

    await this.permissionService.requireCanMutateTodos(userId, listId);

    const existing = await this.repository.findById(input.id);
    if (!existing) {
      throw new NotFoundError(`Todo with ID ${input.id} was not found.`);
    }

    // No-op if status is unchanged
    if (existing.status === input.status) {
      return existing;
    }

    let nextOccurrence: Todo | null = null;
    const result = await withTransaction(this.db, async (tx) => {
      const updated = tx
        ? await this.repository.updateStatus(input.id, input.status, tx)
        : await this.repository.updateStatus(input.id, input.status);

      if (!updated) {
        throw new NotFoundError(`Todo with ID ${input.id} was not found.`);
      }

      await this.activityService.logActivity(
        {
          listId,
          actorId: userId,
          action: "TODO_STATUS_CHANGED",
          entityType: "TODO",
          entityId: updated.id,
          metadata: {
            title: updated.title,
            previousStatus: existing.status,
            newStatus: updated.status,
          },
        },
        tx
      );

      // Trigger automatic occurrence generation when a recurring task is completed
      if (input.status === "DONE" && existing.recurrenceRuleId) {
        nextOccurrence = await this.recurrenceService.handleTaskCompletion(updated, userId, tx);
      }

      return {
        ...updated,
        tags: existing.tags,
        attachmentCount: existing.attachmentCount ?? 0,
      };
    });

    // Broadcast TASK_STATUS_CHANGED event post-commit
    try {
      await this.realtimePublisher.publishTaskStatusChanged(
        listId,
        userId,
        input.clientSessionId ?? null,
        result.id,
        result.status,
        result.version ?? 1,
        result.updatedAt.toISOString()
      );
    } catch {
      // Handled silently inside publisher
    }

    // If an automatic next occurrence was generated, broadcast TASK_CREATED post-commit
    if (nextOccurrence) {
      try {
        const fullNext = await this.repository.findById((nextOccurrence as Todo).id);
        if (fullNext) {
          await this.realtimePublisher.publishTaskCreated(
            listId,
            userId,
            input.clientSessionId ?? null,
            fullNext
          );
        }
      } catch {
        // Handled silently inside publisher
      }
    }

    return result;
  }

  /**
   * Updates the title, description, priority, or due date of a Todo item atomically.
   * Suppresses database writes and activity logs when no values have changed.
   * Records previous and new values for priority and due date in activity metadata.
   */
  async updateDetails(
    input: UpdateTodoDetailsServiceInput,
    userId: string
  ): Promise<TodoWithTags> {
    const listId = await this.repository.findListIdByTodoId(input.id);
    if (!listId) {
      throw new NotFoundError(`Todo with ID ${input.id} was not found.`);
    }

    await this.permissionService.requireCanMutateTodos(userId, listId);

    const existing = await this.repository.findById(input.id);
    if (!existing) {
      throw new NotFoundError(`Todo with ID ${input.id} was not found.`);
    }

    let trimmedTitle: string | undefined = undefined;
    if (input.title !== undefined) {
      trimmedTitle = input.title.trim();
      if (!trimmedTitle) {
        throw new ValidationError("Todo title cannot be empty or solely whitespace.");
      }
    }

    // Check what actually changed
    const titleChanged = trimmedTitle !== undefined && trimmedTitle !== existing.title;
    const descChanged =
      input.description !== undefined &&
      (input.description ?? null) !== (existing.description ?? null);
    const priorityChanged =
      input.priority !== undefined && input.priority !== existing.priority;
    const dueDateChanged =
      input.dueDate !== undefined &&
      (input.dueDate ?? null) !== (existing.dueDate ?? null);

    let tagsChanged = false;
    let verifiedTags: Tag[] = [];
    if (input.tagIds !== undefined) {
      verifiedTags = await this.tagRepository.findByIdsAndListId(
        input.tagIds,
        listId
      );
      if (verifiedTags.length !== input.tagIds.length) {
        throw new ValidationError("One or more selected tags do not belong to this list.");
      }
      const existingTagIds = new Set((existing.tags || []).map((t) => t.id));
      const newTagIds = new Set(input.tagIds);
      if (
        existingTagIds.size !== newTagIds.size ||
        ![...existingTagIds].every((id) => newTagIds.has(id))
      ) {
        tagsChanged = true;
      }
    }

    // Suppress no-op mutations
    if (
      !titleChanged &&
      !descChanged &&
      !priorityChanged &&
      !dueDateChanged &&
      !tagsChanged
    ) {
      return existing;
    }

    const result = await withTransaction(this.db, async (tx) => {
      const details = {
        title: trimmedTitle,
        description: input.description,
        priority: input.priority,
        dueDate: input.dueDate,
      };

      const updated = tx
        ? await this.repository.updateDetails(input.id, details, tx)
        : await this.repository.updateDetails(input.id, details);

      if (!updated) {
        throw new NotFoundError(`Todo with ID ${input.id} was not found.`);
      }

      if (tagsChanged && input.tagIds !== undefined) {
        await this.tagRepository.syncTagsForTodo(input.id, input.tagIds, tx);
      }

      const metadata: Record<string, unknown> = {
        title: updated.title,
      };

      if (titleChanged) {
        metadata.previousTitle = existing.title;
        metadata.newTitle = updated.title;
      }
      if (descChanged) {
        metadata.descriptionChanged = true;
      }
      if (priorityChanged) {
        metadata.previousPriority = existing.priority;
        metadata.newPriority = updated.priority;
      }
      if (dueDateChanged) {
        metadata.previousDueDate = existing.dueDate ?? null;
        metadata.newDueDate = updated.dueDate ?? null;
      }
      if (tagsChanged) {
        metadata.tagsChanged = true;
        metadata.tagCount = input.tagIds?.length || 0;
      }

      await this.activityService.logActivity(
        {
          listId,
          actorId: userId,
          action: "TODO_UPDATED",
          entityType: "TODO",
          entityId: updated.id,
          metadata,
        },
        tx
      );

      return {
        ...updated,
        tags: input.tagIds !== undefined ? verifiedTags : existing.tags,
        attachmentCount: existing.attachmentCount ?? 0,
      };
    });

    // Broadcast TASK_UPDATED event post-commit
    try {
      await this.realtimePublisher.publishTaskUpdated(
        listId,
        userId,
        input.clientSessionId ?? null,
        {
          id: result.id,
          title: result.title,
          description: result.description,
          priority: result.priority,
          dueDate: result.dueDate,
          tags: result.tags,
          attachmentCount: result.attachmentCount,
          version: result.version ?? 1,
          updatedAt: result.updatedAt.toISOString(),
        }
      );
    } catch {
      // Handled silently inside publisher
    }

    return result;
  }

  /**
   * Deletes a todo item by ID atomically with its activity log.
   * Allowed for OWNER and EDITOR roles. Blocked for VIEWER roles.
   */
  async deleteTodo(
    input: DeleteTodoInput,
    userId: string
  ): Promise<{ success: boolean; id: string }> {
    const listId = await this.repository.findListIdByTodoId(input.id);
    if (!listId) {
      throw new NotFoundError(`Todo with ID ${input.id} was not found.`);
    }

    await this.permissionService.requireCanMutateTodos(userId, listId);

    // Retrieve any attachment storage paths before task deletion
    let storagePaths: string[] = [];
    try {
      storagePaths = await this.attachmentRepository.findStoragePathsByTodoId(input.id);
    } catch {
      // In mock/test environments
    }

    const existing = await this.repository.findById(input.id);
    if (!existing) {
      throw new NotFoundError(`Todo with ID ${input.id} was not found.`);
    }

    const result = await withTransaction(this.db, async (tx) => {
      const deleted = tx
        ? await this.repository.delete(input.id, tx)
        : await this.repository.delete(input.id);

      if (!deleted) {
        throw new NotFoundError(`Todo with ID ${input.id} was not found.`);
      }

      const finalVersion =
        typeof deleted === "object" && "version" in deleted
          ? (deleted as { version: number }).version
          : (existing.version ?? 1);

      await this.activityService.logActivity(
        {
          listId,
          actorId: userId,
          action: "TODO_DELETED",
          entityType: "TODO",
          entityId: input.id,
          metadata: {
            id: input.id,
            finalVersion,
          },
        },
        tx
      );

      return { success: true, id: input.id, version: finalVersion };
    });

    // Clean up storage objects if any existed
    if (storagePaths.length > 0) {
      try {
        await this.storageAdapter.removeObjects(storagePaths);
      } catch {
        // Storage cleanup failures are handled by background sweeper
      }
    }

    // Broadcast TASK_DELETED event post-commit with true final version
    try {
      await this.realtimePublisher.publishTaskDeleted(
        listId,
        userId,
        input.clientSessionId ?? null,
        input.id,
        result.version
      );
    } catch {
      // Handled silently inside publisher
    }

    return { success: result.success, id: result.id };
  }
}

// Default singleton instance for application runtime
export const todoService = new TodoService();
