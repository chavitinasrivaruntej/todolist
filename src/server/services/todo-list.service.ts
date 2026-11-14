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

  constructor(
    repository: ITodoListRepository = defaultRepository,
    memberRepository: IListMemberRepository = defaultMemberRepository,
    permissionService: ListPermissionService = defaultPermissionService
  ) {
    this.repository = repository;
    this.memberRepository = memberRepository;
    this.permissionService = permissionService;
  }

  /**
   * Returns all lists (both owned and shared) accessible to the authenticated user.
   * If a user has zero lists total, provisions an initial "Personal" workspace.
   */
  async getLists(userId: string): Promise<TodoListWithTaskCount[]> {
    const lists = await this.repository.findAllWithTaskCounts(userId);
    if (lists.length === 0) {
      const defaultList = await this.repository.create({
        name: "Personal",
        userId,
      });
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
   * Creates a new todo list owned by the authenticated user.
   */
  async createList(input: CreateTodoListInput, userId: string): Promise<TodoList> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new ValidationError("List name cannot be empty or solely whitespace.");
    }

    return this.repository.create({
      name: trimmedName,
      userId,
    });
  }

  /**
   * Renames an existing todo list.
   * Only the OWNER of the list has permission to rename it.
   */
  async renameList(input: RenameTodoListInput, userId: string): Promise<TodoList> {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new ValidationError("List name cannot be empty or solely whitespace.");
    }

    await this.permissionService.requireOwner(userId, input.id);

    const updated = await this.repository.updateName(input.id, trimmedName);
    if (!updated) {
      throw new NotFoundError(`Failed to update todo list with ID ${input.id}.`);
    }

    return updated;
  }

  /**
   * Deletes a todo list according to the safe deletion policy.
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
   * Allows a collaborator to leave a shared list (removes their membership).
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

    return { success: true, listId: input.listId };
  }
}

export const todoListService = new TodoListService();
