import {
  type ITodoListRepository,
  todoListRepository as defaultListRepo,
} from "@/server/repositories/todo-list.repository";
import {
  type IListMemberRepository,
  listMemberRepository as defaultMemberRepo,
} from "@/server/repositories/list-member.repository";
import { NotFoundError, ValidationError } from "@/server/errors";

export type EffectiveRole = "OWNER" | "EDITOR" | "VIEWER";

/**
 * ListPermissionService provides centralized, zero-trust authorization enforcement
 * for list and task actions across owners and collaborators.
 */
export class ListPermissionService {
  private readonly listRepo: ITodoListRepository;
  private readonly memberRepo: IListMemberRepository;

  constructor(
    listRepo: ITodoListRepository = defaultListRepo,
    memberRepo: IListMemberRepository = defaultMemberRepo
  ) {
    this.listRepo = listRepo;
    this.memberRepo = memberRepo;
  }

  /**
   * Resolves the user's role on the given list.
   * Returns 'OWNER', 'EDITOR', 'VIEWER', or null if the user has no access.
   */
  async getUserRole(userId: string, listId: string): Promise<EffectiveRole | null> {
    const list = await this.listRepo.findById(listId);
    if (!list) {
      return null;
    }

    if (list.userId === userId) {
      return "OWNER";
    }

    const membership = await this.memberRepo.findByListAndUser(listId, userId);
    if (membership) {
      return membership.role;
    }

    return null;
  }

  /**
   * Requires that the user is the authoritative OWNER of the list.
   * Throws NotFoundError if list does not exist or user has no access (prevents ID leakage),
   * or ValidationError if user is merely a collaborator.
   */
  async requireOwner(userId: string, listId: string): Promise<void> {
    const role = await this.getUserRole(userId, listId);
    if (!role) {
      throw new NotFoundError(`Todo list with ID ${listId} was not found.`);
    }

    if (role !== "OWNER") {
      throw new ValidationError("Only the list owner has permission to perform this action.");
    }
  }

  /**
   * Requires that the user has mutation privileges (OWNER or EDITOR).
   * Throws NotFoundError if not found or unauthorized, or ValidationError if role is VIEWER.
   */
  async requireCanMutateTodos(
    userId: string,
    listId: string
  ): Promise<"OWNER" | "EDITOR"> {
    const role = await this.getUserRole(userId, listId);
    if (!role) {
      throw new NotFoundError(`Todo list with ID ${listId} was not found.`);
    }

    if (role === "VIEWER") {
      throw new ValidationError("Viewers have read-only access and cannot modify tasks.");
    }

    return role;
  }

  /**
   * Requires that the user has at least read-only privileges (OWNER, EDITOR, or VIEWER).
   * Throws NotFoundError if list not found or user has no access.
   */
  async requireCanReadList(
    userId: string,
    listId: string
  ): Promise<EffectiveRole> {
    const role = await this.getUserRole(userId, listId);
    if (!role) {
      throw new NotFoundError(`Todo list with ID ${listId} was not found.`);
    }

    return role;
  }
}

export const listPermissionService = new ListPermissionService();

