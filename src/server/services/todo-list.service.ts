import {
  type ITodoListRepository,
  type TodoListWithTaskCount,
  todoListRepository as defaultRepository,
} from "@/server/repositories/todo-list.repository";
import {
  type CreateTodoListInput,
  type RenameTodoListInput,
  type DeleteTodoListInput,
} from "@/lib/validations/list";
import { type TodoList } from "@/db/schema/lists";
import { NotFoundError, ValidationError } from "@/server/errors";

/**
 * TodoListService encapsulates domain logic and business rules for Todo Lists.
 * Enforces safe deletion policies, input normalization, and boundary invariants.
 */
export class TodoListService {
  private readonly repository: ITodoListRepository;

  constructor(repository: ITodoListRepository = defaultRepository) {
    this.repository = repository;
  }

  /**
   * Returns all todo lists ordered chronologically ascending with their task counts.
   */
  async getLists(): Promise<TodoListWithTaskCount[]> {
    return this.repository.findAllWithTaskCounts();
  }

  /**
   * Creates a new todo list. Enforces non-empty trimmed names.
   */
  async createList(input: CreateTodoListInput): Promise<TodoList> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new ValidationError("List name cannot be empty or solely whitespace.");
    }

    return this.repository.create({ name: trimmedName });
  }

  /**
   * Renames an existing todo list.
   */
  async renameList(input: RenameTodoListInput): Promise<TodoList> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new ValidationError("List name cannot be empty or solely whitespace.");
    }

    const existing = await this.repository.findById(input.id);
    if (!existing) {
      throw new NotFoundError(`Todo list with ID ${input.id} was not found.`);
    }

    const updated = await this.repository.updateName(input.id, trimmedName);
    if (!updated) {
      throw new NotFoundError(`Failed to update todo list with ID ${input.id}.`);
    }

    return updated;
  }

  /**
   * Deletes a todo list according to the safe deletion policy.
   * If the list contains tasks and force is false, rejects deletion.
   */
  async deleteList(input: DeleteTodoListInput): Promise<{ success: boolean; id: string }> {
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
}

export const todoListService = new TodoListService();

