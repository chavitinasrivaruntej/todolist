import {
  type ITodoRepository,
  todoRepository as defaultRepository,
} from "@/server/repositories/todo.repository";
import {
  type ITodoListRepository,
  todoListRepository as defaultListRepository,
} from "@/server/repositories/todo-list.repository";
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
 * Completely decoupled from API transport (tRPC) and database implementations.
 */
export class TodoService {
  private readonly repository: ITodoRepository;
  private readonly listRepository: ITodoListRepository;

  constructor(
    repository: ITodoRepository = defaultRepository,
    listRepository: ITodoListRepository = defaultListRepository
  ) {
    this.repository = repository;
    this.listRepository = listRepository;
  }

  /**
   * Retrieves all todo items belonging to a specific list, ordered descending by creation date.
   */
  async getTodosByList(input: GetTodosByListInput): Promise<Todo[]> {
    const listExists = await this.listRepository.findById(input.listId);
    if (!listExists) {
      throw new NotFoundError(`Todo list with ID ${input.listId} was not found.`);
    }

    return this.repository.findAllByListId(input.listId);
  }

  /**
   * Creates a new todo item associated with a specific list.
   * Enforces non-empty trimmed titles and valid list associations.
   */
  async createTodo(input: CreateTodoServiceInput): Promise<Todo> {
    const trimmedTitle = input.title.trim();
    if (!trimmedTitle) {
      throw new ValidationError("Todo title cannot be empty or solely whitespace.");
    }

    const listExists = await this.listRepository.findById(input.listId);
    if (!listExists) {
      throw new NotFoundError(`Cannot create todo: Todo list with ID ${input.listId} does not exist.`);
    }

    return this.repository.create({
      listId: input.listId,
      title: trimmedTitle,
      description: input.description ?? null,
      status: input.status ?? "TODO",
    });
  }

  /**
   * Updates the status of an existing Todo item.
   */
  async updateStatus(input: UpdateTodoStatusInput): Promise<Todo> {
    const updated = await this.repository.updateStatus(input.id, input.status);
    if (!updated) {
      throw new NotFoundError(`Todo with ID ${input.id} was not found.`);
    }

    return updated;
  }

  /**
   * Deletes a todo item by ID in a single atomic database operation.
   * If no record was deleted, throws a domain-level NotFoundError.
   */
  async deleteTodo(input: DeleteTodoInput): Promise<{ success: boolean; id: string }> {
    const deleted = await this.repository.delete(input.id);
    if (!deleted) {
      throw new NotFoundError(`Todo with ID ${input.id} was not found.`);
    }

    return { success: true, id: input.id };
  }
}

// Default singleton instance for application runtime
export const todoService = new TodoService();
