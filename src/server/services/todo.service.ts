import { type ITodoRepository, todoRepository as defaultRepository } from "@/server/repositories/todo.repository";
import { type CreateTodoInput, type DeleteTodoInput } from "@/lib/validations/todo";
import { type Todo } from "@/db/schema/todos";
import { NotFoundError, ValidationError } from "@/server/errors";

/**
 * TodoService encapsulates domain rules and business logic for Todo operations.
 * Completely decoupled from API transport (tRPC) and database implementations.
 */
export class TodoService {
  private readonly repository: ITodoRepository;

  constructor(repository: ITodoRepository = defaultRepository) {
    this.repository = repository;
  }

  /**
   * Retrieves all todo items ordered chronologically descending (newest first).
   */
  async getTodos(): Promise<Todo[]> {
    return this.repository.findAll();
  }

  /**
   * Creates a new todo item after validating business requirements.
   */
  async createTodo(input: CreateTodoInput): Promise<Todo> {
    const trimmedTitle = input.title.trim();
    if (!trimmedTitle) {
      throw new ValidationError("Todo title cannot be empty or solely whitespace.");
    }

    return this.repository.create({
      title: trimmedTitle,
      description: input.description ?? null,
    });
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
