import { eq, and, lte, desc, sql } from "drizzle-orm";
import { db as defaultDb, type Database, type DbExecutor } from "@/db";
import {
  recurrenceRules,
  type RecurrenceRule,
  type NewRecurrenceRule,
  type RecurrenceStatus,
} from "@/db/schema/recurrence";

export interface IRecurrenceRepository {
  createRule(
    data: Omit<NewRecurrenceRule, "id" | "createdAt" | "updatedAt">,
    tx?: DbExecutor
  ): Promise<RecurrenceRule>;
  findById(id: string, tx?: DbExecutor): Promise<RecurrenceRule | null>;
  findByIdForUpdate(id: string, tx?: DbExecutor): Promise<RecurrenceRule | null>;
  findByListId(listId: string): Promise<RecurrenceRule[]>;
  updateRule(
    id: string,
    data: Partial<Omit<NewRecurrenceRule, "id" | "listId" | "createdAt">>,
    tx?: DbExecutor
  ): Promise<RecurrenceRule | null>;
  deleteRule(id: string, tx?: DbExecutor): Promise<boolean>;
  findDueActiveRules(todayDate: string, tx?: DbExecutor): Promise<RecurrenceRule[]>;
}

export class RecurrenceRepository implements IRecurrenceRepository {
  private readonly db: Database;

  constructor(database: Database = defaultDb) {
    this.db = database;
  }

  private getExecutor(tx?: DbExecutor): DbExecutor {
    return tx || this.db;
  }

  async createRule(
    data: Omit<NewRecurrenceRule, "id" | "createdAt" | "updatedAt">,
    tx?: DbExecutor
  ): Promise<RecurrenceRule> {
    const executor = this.getExecutor(tx);
    const [created] = await executor
      .insert(recurrenceRules)
      .values(data)
      .returning();
    return created!;
  }

  async findById(id: string, tx?: DbExecutor): Promise<RecurrenceRule | null> {
    const executor = this.getExecutor(tx);
    const [rule] = await executor
      .select()
      .from(recurrenceRules)
      .where(eq(recurrenceRules.id, id))
      .limit(1);
    return rule || null;
  }

  async findByIdForUpdate(id: string, tx?: DbExecutor): Promise<RecurrenceRule | null> {
    const executor = this.getExecutor(tx);
    // In live PostgreSQL, perform SELECT ... FOR UPDATE to lock the recurrence schedule row
    const [rule] = await executor
      .select()
      .from(recurrenceRules)
      .where(eq(recurrenceRules.id, id))
      .for("update")
      .limit(1);
    return rule || null;
  }

  async findByListId(listId: string): Promise<RecurrenceRule[]> {
    return this.db
      .select()
      .from(recurrenceRules)
      .where(eq(recurrenceRules.listId, listId))
      .orderBy(desc(recurrenceRules.createdAt));
  }

  async updateRule(
    id: string,
    data: Partial<Omit<NewRecurrenceRule, "id" | "listId" | "createdAt">>,
    tx?: DbExecutor
  ): Promise<RecurrenceRule | null> {
    const executor = this.getExecutor(tx);
    const [updated] = await executor
      .update(recurrenceRules)
      .set(data)
      .where(eq(recurrenceRules.id, id))
      .returning();
    return updated || null;
  }

  async deleteRule(id: string, tx?: DbExecutor): Promise<boolean> {
    const executor = this.getExecutor(tx);
    const [deleted] = await executor
      .delete(recurrenceRules)
      .where(eq(recurrenceRules.id, id))
      .returning({ id: recurrenceRules.id });
    return Boolean(deleted);
  }

  async findDueActiveRules(todayDate: string, tx?: DbExecutor): Promise<RecurrenceRule[]> {
    const executor = this.getExecutor(tx);
    return executor
      .select()
      .from(recurrenceRules)
      .where(
        and(
          eq(recurrenceRules.status, "ACTIVE"),
          lte(recurrenceRules.nextDueDate, todayDate)
        )
      )
      .orderBy(recurrenceRules.nextDueDate);
  }
}

export const recurrenceRepository = new RecurrenceRepository();

