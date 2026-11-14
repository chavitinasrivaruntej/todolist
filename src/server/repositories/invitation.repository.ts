import { eq, and } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/db";
import {
  listInvitations,
  type ListInvitation,
  type InvitationStatus,
} from "@/db/schema/invitations";
import type { ListMemberRole } from "@/db/schema/members";

export interface IInvitationRepository {
  findByTokenHash(tokenHash: string): Promise<ListInvitation | null>;
  findById(id: string): Promise<ListInvitation | null>;
  findPendingByListId(listId: string): Promise<ListInvitation[]>;
  findPendingByEmailAndList(email: string, listId: string): Promise<ListInvitation | null>;
  create(data: {
    listId: string;
    inviterId: string;
    email: string;
    role: ListMemberRole;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<ListInvitation>;
  updateTokenAndExpiry(
    id: string,
    data: { tokenHash: string; role: ListMemberRole; expiresAt: Date }
  ): Promise<ListInvitation | null>;
  updateStatus(
    id: string,
    status: InvitationStatus,
    acceptedAt?: Date
  ): Promise<ListInvitation | null>;
  delete(id: string): Promise<boolean>;
}

export class InvitationRepository implements IInvitationRepository {
  private readonly db: Database;

  constructor(database: Database = defaultDb) {
    this.db = database;
  }

  async findByTokenHash(tokenHash: string): Promise<ListInvitation | null> {
    const [invitation] = await this.db
      .select()
      .from(listInvitations)
      .where(eq(listInvitations.tokenHash, tokenHash))
      .limit(1);

    return invitation ?? null;
  }

  async findById(id: string): Promise<ListInvitation | null> {
    const [invitation] = await this.db
      .select()
      .from(listInvitations)
      .where(eq(listInvitations.id, id))
      .limit(1);

    return invitation ?? null;
  }

  async findPendingByListId(listId: string): Promise<ListInvitation[]> {
    return this.db
      .select()
      .from(listInvitations)
      .where(
        and(
          eq(listInvitations.listId, listId),
          eq(listInvitations.status, "PENDING")
        )
      );
  }

  async findPendingByEmailAndList(
    email: string,
    listId: string
  ): Promise<ListInvitation | null> {
    const [invitation] = await this.db
      .select()
      .from(listInvitations)
      .where(
        and(
          eq(listInvitations.listId, listId),
          eq(listInvitations.email, email.toLowerCase()),
          eq(listInvitations.status, "PENDING")
        )
      )
      .limit(1);

    return invitation ?? null;
  }

  async create(data: {
    listId: string;
    inviterId: string;
    email: string;
    role: ListMemberRole;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<ListInvitation> {
    const [created] = await this.db
      .insert(listInvitations)
      .values({
        listId: data.listId,
        inviterId: data.inviterId,
        email: data.email.toLowerCase(),
        role: data.role,
        tokenHash: data.tokenHash,
        status: "PENDING",
        expiresAt: data.expiresAt,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to insert list_invitation record.");
    }

    return created;
  }

  async updateTokenAndExpiry(
    id: string,
    data: { tokenHash: string; role: ListMemberRole; expiresAt: Date }
  ): Promise<ListInvitation | null> {
    const [updated] = await this.db
      .update(listInvitations)
      .set({
        tokenHash: data.tokenHash,
        role: data.role,
        expiresAt: data.expiresAt,
        status: "PENDING",
      })
      .where(eq(listInvitations.id, id))
      .returning();

    return updated ?? null;
  }

  async updateStatus(
    id: string,
    status: InvitationStatus,
    acceptedAt?: Date
  ): Promise<ListInvitation | null> {
    const [updated] = await this.db
      .update(listInvitations)
      .set({
        status,
        acceptedAt: acceptedAt ?? null,
      })
      .where(eq(listInvitations.id, id))
      .returning();

    return updated ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(listInvitations)
      .where(eq(listInvitations.id, id))
      .returning({ id: listInvitations.id });

    return deleted.length > 0;
  }
}

export const invitationRepository = new InvitationRepository();

