import { eq, and, sql, inArray } from "drizzle-orm";
import { db as defaultDb, type Database, type DbExecutor } from "@/db";
import { tags, todoTags, type Tag, type NewTag } from "@/db/schema/tags";

export interface ITagRepository {
  findAllByListId(listId: string): Promise<Tag[]>;
  findById(id: string): Promise<Tag | null>;
  findByNameAndListId(name: string, listId: string): Promise<Tag | null>;
  findByIdsAndListId(ids: string[], listId: string): Promise<Tag[]>;
  create(
    data: { listId: string; name: string; color?: string },
    tx?: DbExecutor
  ): Promise<Tag>;
  update(
    id: string,
    data: { name?: string; color?: string },
    tx?: DbExecutor
  ): Promise<Tag | null>;
  delete(id: string, tx?: DbExecutor): Promise<boolean>;

  // Task-Tag associations
  findTagsForTodo(todoId: string): Promise<Tag[]>;
  findTagsForTodos(todoIds: string[]): Promise<Map<string, Tag[]>>;
  assignTagsToTodo(todoId: string, tagIds: string[], tx?: DbExecutor): Promise<void>;
  syncTagsForTodo(
    todoId: string,
    tagIds: string[],
    tx?: DbExecutor
  ): Promise<{ added: string[]; removed: string[] }>;
}

export class TagRepository implements ITagRepository {
  private readonly db: Database;

  constructor(database: Database = defaultDb) {
    this.db = database;
  }

  async findAllByListId(listId: string): Promise<Tag[]> {
    return this.db
      .select()
      .from(tags)
      .where(eq(tags.listId, listId))
      .orderBy(tags.name);
  }

  async findById(id: string): Promise<Tag | null> {
    const [result] = await this.db.select().from(tags).where(eq(tags.id, id)).limit(1);
    return result || null;
  }

  async findByNameAndListId(name: string, listId: string): Promise<Tag | null> {
    const trimmed = name.trim();
    const [result] = await this.db
      .select()
      .from(tags)
      .where(
        and(
          eq(tags.listId, listId),
          sql`lower(${tags.name}) = lower(${trimmed})`
        )
      )
      .limit(1);
    return result || null;
  }

  async findByIdsAndListId(ids: string[], listId: string): Promise<Tag[]> {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(tags)
      .where(and(inArray(tags.id, ids), eq(tags.listId, listId)));
  }

  async create(
    data: { listId: string; name: string; color?: string },
    tx?: DbExecutor
  ): Promise<Tag> {
    const executor = tx || this.db;
    const [created] = await executor
      .insert(tags)
      .values({
        listId: data.listId,
        name: data.name.trim(),
        color: data.color || "slate",
      })
      .returning();
    return created;
  }

  async update(
    id: string,
    data: { name?: string; color?: string },
    tx?: DbExecutor
  ): Promise<Tag | null> {
    const executor = tx || this.db;
    const updateValues: Partial<NewTag> = {};
    if (data.name !== undefined) updateValues.name = data.name.trim();
    if (data.color !== undefined) updateValues.color = data.color;

    const [updated] = await executor
      .update(tags)
      .set(updateValues)
      .where(eq(tags.id, id))
      .returning();

    return updated || null;
  }

  async delete(id: string, tx?: DbExecutor): Promise<boolean> {
    const executor = tx || this.db;
    const deleted = await executor.delete(tags).where(eq(tags.id, id)).returning();
    return deleted.length > 0;
  }

  async findTagsForTodo(todoId: string): Promise<Tag[]> {
    const rows = await this.db
      .select({
        id: tags.id,
        listId: tags.listId,
        name: tags.name,
        color: tags.color,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
      })
      .from(todoTags)
      .innerJoin(tags, eq(todoTags.tagId, tags.id))
      .where(eq(todoTags.todoId, todoId))
      .orderBy(tags.name);

    return rows;
  }

  async findTagsForTodos(todoIds: string[]): Promise<Map<string, Tag[]>> {
    const resultMap = new Map<string, Tag[]>();
    if (todoIds.length === 0) return resultMap;

    const rows = await this.db
      .select({
        todoId: todoTags.todoId,
        tag: tags,
      })
      .from(todoTags)
      .innerJoin(tags, eq(todoTags.tagId, tags.id))
      .where(inArray(todoTags.todoId, todoIds))
      .orderBy(tags.name);

    for (const row of rows) {
      const existing = resultMap.get(row.todoId) || [];
      existing.push(row.tag);
      resultMap.set(row.todoId, existing);
    }

    return resultMap;
  }

  async assignTagsToTodo(
    todoId: string,
    tagIds: string[],
    tx?: DbExecutor
  ): Promise<void> {
    if (tagIds.length === 0) return;
    const executor = tx || this.db;

    const values = tagIds.map((tagId) => ({
      todoId,
      tagId,
    }));

    await executor.insert(todoTags).values(values).onConflictDoNothing();
  }

  async syncTagsForTodo(
    todoId: string,
    tagIds: string[],
    tx?: DbExecutor
  ): Promise<{ added: string[]; removed: string[] }> {
    const executor = tx || this.db;

    const currentRows = await executor
      .select({ tagId: todoTags.tagId })
      .from(todoTags)
      .where(eq(todoTags.todoId, todoId));

    const currentTagIds = new Set(currentRows.map((r) => r.tagId));
    const targetTagIds = new Set(tagIds);

    const toAdd = tagIds.filter((id) => !currentTagIds.has(id));
    const toRemove = Array.from(currentTagIds).filter((id) => !targetTagIds.has(id));

    if (toRemove.length > 0) {
      await executor
        .delete(todoTags)
        .where(
          and(
            eq(todoTags.todoId, todoId),
            inArray(todoTags.tagId, toRemove)
          )
        );
    }

    if (toAdd.length > 0) {
      await executor
        .insert(todoTags)
        .values(toAdd.map((tagId) => ({ todoId, tagId })))
        .onConflictDoNothing();
    }

    return { added: toAdd, removed: toRemove };
  }
}

export const tagRepository = new TagRepository();
