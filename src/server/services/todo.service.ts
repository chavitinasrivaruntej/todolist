import { TRPCError } from "@trpc/server";
import { type ITodoRepository, todoRepository as defaultRepository } from "@/server/repositories/todo.repository";
import { type CreateTodoInput, type DeleteTodoInput } from "@/lib/validations/todo";
import { type Todo } from "@/db/schema/todos";

/**
 * TodoService encapsulates domain rules and business logic for Todo operations.
 * Decouples business rules from API transport (tRPC) and database implementations.
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
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Todo title cannot be empty or solely whitespace.",
      });
    }

    return this.repository.create({
      title: trimmedTitle,
      description: input.description ?? null,
    });
  }

  /**
   * Deletes a todo item by ID. Validates existence before deletion.
   */
  async deleteTodo(input: DeleteTodoInput): Promise<{ success: boolean; id: string }> {
    const existing = await this.repository.findById(input.id);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Todo with ID ${input.id} was not found.`,
      });
    }

    const deleted = await this.repository.delete(input.id);
    if (!deleted) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete the requested todo item.",
      });
    }

    return { success: true, id: input.id };
  }
}

// Default singleton instance for application runtime
export const todoService = new TodoService();
