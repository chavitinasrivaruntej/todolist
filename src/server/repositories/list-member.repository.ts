import { eq, and } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/db";
import { listMembers, type ListMember, type ListMemberRole } from "@/db/schema/members";
import { sql } from "drizzle-orm";

export interface ListMemberWithUser extends ListMember {
  email?: string | null;
}

export interface IListMemberRepository {
  findById(id: string): Promise<ListMember | null>;
  findByListAndUser(listId: string, userId: string): Promise<ListMember | null>;
  findAllByListId(listId: string): Promise<ListMemberWithUser[]>;
  addMember(data: { listId: string; userId: string; role: ListMemberRole }): Promise<ListMember>;
  updateRole(id: string, role: ListMemberRole): Promise<ListMember | null>;
  deleteMember(id: string): Promise<boolean>;
  deleteByListAndUser(listId: string, userId: string): Promise<boolean>;
}

export class ListMemberRepository implements IListMemberRepository {
  private readonly db: Database;

  constructor(database: Database = defaultDb) {
    this.db = database;
  }

  async findById(id: string): Promise<ListMember | null> {
    const [member] = await this.db
      .select()
      .from(listMembers)
      .where(eq(listMembers.id, id))
      .limit(1);

    return member ?? null;
  }

  async findByListAndUser(listId: string, userId: string): Promise<ListMember | null> {
    const [member] = await this.db
      .select()
      .from(listMembers)
      .where(and(eq(listMembers.listId, listId), eq(listMembers.userId, userId)))
      .limit(1);

    return member ?? null;
  }

  async findAllByListId(listId: string): Promise<ListMemberWithUser[]> {
    // Left join with auth.users to retrieve collaborator emails
    const rows = await this.db.execute(sql`
      SELECT 
        lm.id,
        lm.list_id AS "listId",
        lm.user_id AS "userId",
        lm.role,
        lm.created_at AS "createdAt",
        lm.updated_at AS "updatedAt",
        u.email
      FROM list_members lm
      LEFT JOIN auth.users u ON u.id = lm.user_id
      WHERE lm.list_id = ${listId}::uuid
      ORDER BY lm.created_at ASC;
    `);

    return (rows as unknown as ListMemberWithUser[]) ?? [];
  }

  async addMember(data: {
    listId: string;
    userId: string;
    role: ListMemberRole;
  }): Promise<ListMember> {
    const [member] = await this.db
      .insert(listMembers)
      .values({
        listId: data.listId,
        userId: data.userId,
        role: data.role,
      })
      .returning();

    if (!member) {
      throw new Error("Failed to insert list_member record.");
    }

    return member;
  }

  async updateRole(id: string, role: ListMemberRole): Promise<ListMember | null> {
    const [updated] = await this.db
      .update(listMembers)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(listMembers.id, id))
      .returning();

    return updated ?? null;
  }

  async deleteMember(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(listMembers)
      .where(eq(listMembers.id, id))
      .returning({ id: listMembers.id });

    return deleted.length > 0;
  }

  async deleteByListAndUser(listId: string, userId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(listMembers)
      .where(and(eq(listMembers.listId, listId), eq(listMembers.userId, userId)))
      .returning({ id: listMembers.id });

    return deleted.length > 0;
  }
}

export const listMemberRepository = new ListMemberRepository();
