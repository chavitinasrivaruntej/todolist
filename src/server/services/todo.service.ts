import {
  type ITodoRepository,
  todoRepository as defaultRepository,
} from "@/server/repositories/todo.repository";
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
import { type Todo, type TodoStatus } from "@/db/schema/todos";
import { NotFoundError, ValidationError } from "@/server/errors";

export interface CreateTodoServiceInput {
  listId: string;
  title: string;
  description?: string | null;
  status?: TodoStatus;
}

export interface UpdateTodoDetailsServiceInput {
  id: string;
  title?: string;
  description?: string | null;
}

/**
 * TodoService encapsulates domain rules and business logic for Todo operations.
 * Enforces role-based permissions (OWNER, EDITOR, VIEWER) and records immutable activity logs.
 */
export class TodoService {
  private readonly repository: ITodoRepository;
  private readonly permissionService: ListPermissionService;
  private readonly activityService: ActivityService;
  private readonly db: Database;

  constructor(
    repository: ITodoRepository = defaultRepository,
    permissionService: ListPermissionService = defaultPermissionService,
    activityService: ActivityService = defaultActivityService,
    database: Database = defaultDb
  ) {
    this.repository = repository;
    this.permissionService = permissionService;
    this.activityService = activityService;
    this.db = database;
  }

  /**
   * Retrieves all todo items belonging to a specific list.
   * Allowed for OWNER, EDITOR, and VIEWER roles.
   */
  async getTodosByList(
    input: GetTodosByListInput,
    userId: string
  ): Promise<Todo[]> {
    await this.permissionService.requireCanReadList(userId, input.listId);
    return this.repository.findAllByListId(input.listId);
  }

  /**
   * Creates a new todo item within a list atomically with its activity log.
   * Allowed for OWNER and EDITOR roles. Blocked for VIEWER roles.
   */
  async createTodo(
    input: CreateTodoServiceInput,
    userId: string
  ): Promise<Todo> {
    const trimmedTitle = input.title.trim();
    if (!trimmedTitle) {
      throw new ValidationError(
        "Todo title cannot be empty or solely whitespace."
      );
    }

    await this.permissionService.requireCanMutateTodos(userId, input.listId);

    return withTransaction(this.db, async (tx) => {
      const todoData = {
        listId: input.listId,
        title: trimmedTitle,
        description: input.description ?? null,
        status: input.status ?? "TODO",
      };

      const created = tx
        ? await this.repository.create(todoData, tx)
        : await this.repository.create(todoData);

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
          },
        },
        tx
      );

      return created;
    });
  }

  /**
   * Updates the status of an existing Todo item atomically with its activity log.
   * Allowed for OWNER and EDITOR roles. Blocked for VIEWER roles.
   */
  async updateStatus(
    input: UpdateTodoStatusInput,
    userId: string
  ): Promise<Todo> {
    const listId = await this.repository.findListIdByTodoId(input.id);
    if (!listId) {
      throw new NotFoundError(`Todo with ID ${input.id} was not found.`);
    }

    await this.permissionService.requireCanMutateTodos(userId, listId);

    return withTransaction(this.db, async (tx) => {
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
            previousStatus: "TODO",
            newStatus: updated.status,
          },
        },
        tx
      );

      return updated;
    });
  }

  /**
   * Updates the title or description of a Todo item atomically with its activity log.
   */
  async updateDetails(
    input: UpdateTodoDetailsServiceInput,
    userId: string
  ): Promise<Todo> {
    const listId = await this.repository.findListIdByTodoId(input.id);
    if (!listId) {
      throw new NotFoundError(`Todo with ID ${input.id} was not found.`);
    }

    await this.permissionService.requireCanMutateTodos(userId, listId);

    let trimmedTitle: string | undefined = undefined;
    if (input.title !== undefined) {
      trimmedTitle = input.title.trim();
      if (!trimmedTitle) {
        throw new ValidationError("Todo title cannot be empty or solely whitespace.");
      }
    }

    return withTransaction(this.db, async (tx) => {
      const details = {
        title: trimmedTitle,
        description: input.description,
      };

      const updated = tx
        ? await this.repository.updateDetails(input.id, details, tx)
        : await this.repository.updateDetails(input.id, details);

      if (!updated) {
        throw new NotFoundError(`Todo with ID ${input.id} was not found.`);
      }

      await this.activityService.logActivity(
        {
          listId,
          actorId: userId,
          action: "TODO_UPDATED",
          entityType: "TODO",
          entityId: updated.id,
          metadata: {
            newTitle: updated.title,
            descriptionChanged: input.description !== undefined,
          },
        },
        tx
      );

      return updated;
    });
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

    return withTransaction(this.db, async (tx) => {
      const deleted = tx
        ? await this.repository.delete(input.id, tx)
        : await this.repository.delete(input.id);

      if (!deleted) {
        throw new NotFoundError(`Todo with ID ${input.id} was not found.`);
      }

      await this.activityService.logActivity(
        {
          listId,
          actorId: userId,
          action: "TODO_DELETED",
          entityType: "TODO",
          entityId: input.id,
          metadata: {
            id: input.id,
          },
        },
        tx
      );

      return { success: true, id: input.id };
    });
  }
}

// Default singleton instance for application runtime
export const todoService = new TodoService();
