import {
  type ITodoRepository,
  todoRepository as defaultRepository,
} from "@/server/repositories/todo.repository";
import {
  ListPermissionService,
  listPermissionService as defaultPermissionService,
} from "@/server/services/list-permission.service";
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

/**
 * TodoService encapsulates domain rules and business logic for Todo operations.
 * Enforces role-based permissions (OWNER, EDITOR, VIEWER) on all task operations.
 */
export class TodoService {
  private readonly repository: ITodoRepository;
  private readonly permissionService: ListPermissionService;

  constructor(
    repository: ITodoRepository = defaultRepository,
    permissionService: ListPermissionService = defaultPermissionService
  ) {
    this.repository = repository;
    this.permissionService = permissionService;
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
   * Creates a new todo item within a list.
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

    return this.repository.create({
      listId: input.listId,
      title: trimmedTitle,
      description: input.description ?? null,
      status: input.status ?? "TODO",
    });
  }

  /**
   * Updates the status of an existing Todo item.
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

    const updated = await this.repository.updateStatus(input.id, input.status);
    if (!updated) {
      throw new NotFoundError(`Todo with ID ${input.id} was not found.`);
    }

    return updated;
  }

  /**
   * Deletes a todo item by ID.
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

    const deleted = await this.repository.delete(input.id);
    if (!deleted) {
      throw new NotFoundError(`Todo with ID ${input.id} was not found.`);
    }

    return { success: true, id: input.id };
  }
}

// Default singleton instance for application runtime
export const todoService = new TodoService();
