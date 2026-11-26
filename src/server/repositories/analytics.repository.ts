import { and, asc, count, eq, gt, gte, inArray, lt, min, or, sql } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/db";
import { todos, type TodoStatus, type TodoPriority } from "@/db/schema/todos";
import { todoLists } from "@/db/schema/lists";
import { tags, todoTags } from "@/db/schema/tags";
import { recurrenceRules } from "@/db/schema/recurrence";
import { activityLogs } from "@/db/schema/activities";
import { tagRepository as defaultTagRepo, type ITagRepository } from "@/server/repositories/tag.repository";
import type {
  StatusDistributionItem,
  PriorityDistributionItem,
  TagDistributionItem,
  ExportedTodoItem,
} from "@/lib/validations/analytics";

export interface OverviewAggregatesRow {
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
  overdueTasks: number;
  statusDistribution: StatusDistributionItem[];
  priorityDistribution: PriorityDistributionItem[];
  tagDistribution: TagDistributionItem[];
}

export interface WeeklyVelocityBucketRow {
  weekStart: string; // YYYY-MM-DD (Monday UTC)
  createdCount: number;
  completedCount: number;
}

export interface VelocityAggregatesRow {
  buckets: WeeklyVelocityBucketRow[];
  historicalCoverageStart: Date | null;
}

export interface ExportCursor {
  createdAt: Date;
  id: string;
}

export interface ExportBatchResult {
  items: ExportedTodoItem[];
  nextCursor: ExportCursor | null;
}

export interface IAnalyticsRepository {
  getOverviewAggregates(listIds: string[], reportingDate: string): Promise<OverviewAggregatesRow>;
  getWeeklyVelocityAggregates(
    listIds: string[],
    rangeStart: Date,
    rangeEndExclusive: Date
  ): Promise<VelocityAggregatesRow>;
  countExportableTasks(listIds: string[]): Promise<number>;
  getExportBatch(
    listIds: string[],
    cursor: ExportCursor | null,
    limit: number
  ): Promise<ExportBatchResult>;
}

export class AnalyticsRepository implements IAnalyticsRepository {
  private readonly db: Database;
  private readonly tagRepo: ITagRepository;

  constructor(database: Database = defaultDb, tagRepo: ITagRepository = defaultTagRepo) {
    this.db = database;
    this.tagRepo = tagRepo;
  }

  async getOverviewAggregates(
    listIds: string[],
    reportingDate: string
  ): Promise<OverviewAggregatesRow> {
    if (listIds.length === 0) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        openTasks: 0,
        overdueTasks: 0,
        statusDistribution: [],
        priorityDistribution: [],
        tagDistribution: [],
      };
    }

    const listFilter = inArray(todos.listId, listIds);

    const [summaryRows, statusRows, priorityRows, tagRows] = await Promise.all([
      this.db
        .select({
          totalTasks: sql<number>`count(*)::int`,
          completedTasks: sql<number>`count(*) filter (where ${todos.status} = 'DONE')::int`,
          openTasks: sql<number>`count(*) filter (where ${todos.status} <> 'DONE')::int`,
          overdueTasks: sql<number>`count(*) filter (where ${todos.status} <> 'DONE' and ${todos.dueDate} is not null and ${todos.dueDate} < ${reportingDate})::int`,
        })
        .from(todos)
        .where(listFilter),

      this.db
        .select({
          status: todos.status,
          count: sql<number>`count(*)::int`,
        })
        .from(todos)
        .where(listFilter)
        .groupBy(todos.status),

      this.db
        .select({
          priority: todos.priority,
          count: sql<number>`count(*)::int`,
        })
        .from(todos)
        .where(listFilter)
        .groupBy(todos.priority),

      this.db
        .select({
          tagId: tags.id,
          name: tags.name,
          color: tags.color,
          count: sql<number>`count(${todoTags.todoId})::int`,
        })
        .from(tags)
        .innerJoin(todoTags, eq(todoTags.tagId, tags.id))
        .where(inArray(tags.listId, listIds))
        .groupBy(tags.id, tags.name, tags.color)
        .orderBy(sql`count(${todoTags.todoId}) desc`, asc(tags.name)),
    ]);

    const summary = summaryRows[0] ?? {
      totalTasks: 0,
      completedTasks: 0,
      openTasks: 0,
      overdueTasks: 0,
    };

    return {
      totalTasks: Number(summary.totalTasks),
      completedTasks: Number(summary.completedTasks),
      openTasks: Number(summary.openTasks),
      overdueTasks: Number(summary.overdueTasks),
      statusDistribution: statusRows.map((r) => ({
        status: r.status as TodoStatus,
        count: Number(r.count),
      })),
      priorityDistribution: priorityRows.map((r) => ({
        priority: r.priority as TodoPriority,
        count: Number(r.count),
      })),
      tagDistribution: tagRows.map((r) => ({
        tagId: r.tagId,
        name: r.name,
        color: r.color,
        count: Number(r.count),
      })),
    };
  }

  async getWeeklyVelocityAggregates(
    listIds: string[],
    rangeStart: Date,
    rangeEndExclusive: Date
  ): Promise<VelocityAggregatesRow> {
    if (listIds.length === 0) {
      return {
        buckets: [],
        historicalCoverageStart: null,
      };
    }

    const weekTruncExpr = sql`date_trunc('week', ${activityLogs.createdAt} AT TIME ZONE 'UTC')`;

    const [bucketRows, coverageRows] = await Promise.all([
      this.db
        .select({
          weekStart: sql<string>`to_char(${weekTruncExpr}, 'YYYY-MM-DD')`,
          createdCount: sql<number>`count(*) filter (where ${activityLogs.action} in ('TODO_CREATED', 'RECURRING_OCCURRENCE_GENERATED', 'RECURRENCE_CREATED'))::int`,
          completedCount: sql<number>`count(*) filter (where (${activityLogs.action} = 'TODO_STATUS_CHANGED' and ${activityLogs.metadata}->>'newStatus' = 'DONE') or (${activityLogs.action} = 'TODO_CREATED' and ${activityLogs.metadata}->>'status' = 'DONE'))::int`,
        })
        .from(activityLogs)
        .where(
          and(
            inArray(activityLogs.listId, listIds),
            gte(activityLogs.createdAt, rangeStart),
            lt(activityLogs.createdAt, rangeEndExclusive),
            inArray(activityLogs.action, [
              "TODO_CREATED",
              "RECURRING_OCCURRENCE_GENERATED",
              "RECURRENCE_CREATED",
              "TODO_STATUS_CHANGED",
            ])
          )
        )
        .groupBy(weekTruncExpr)
        .orderBy(asc(weekTruncExpr)),

      this.db
        .select({
          earliest: min(activityLogs.createdAt),
        })
        .from(activityLogs)
        .where(inArray(activityLogs.listId, listIds)),
    ]);

    return {
      buckets: bucketRows.map((r) => ({
        weekStart: r.weekStart,
        createdCount: Number(r.createdCount),
        completedCount: Number(r.completedCount),
      })),
      historicalCoverageStart: coverageRows[0]?.earliest ?? null,
    };
  }

  async countExportableTasks(listIds: string[]): Promise<number> {
    if (listIds.length === 0) return 0;

    const [row] = await this.db
      .select({ total: count() })
      .from(todos)
      .where(inArray(todos.listId, listIds));

    return Number(row?.total ?? 0);
  }

  async getExportBatch(
    listIds: string[],
    cursor: ExportCursor | null,
    limit: number
  ): Promise<ExportBatchResult> {
    if (listIds.length === 0) {
      return { items: [], nextCursor: null };
    }

    const conditions = [inArray(todos.listId, listIds)];
    if (cursor) {
      conditions.push(
        or(
          gt(todos.createdAt, cursor.createdAt),
          and(eq(todos.createdAt, cursor.createdAt), gt(todos.id, cursor.id))
        )!
      );
    }

    const rows = await this.db
      .select({
        id: todos.id,
        title: todos.title,
        description: todos.description,
        status: todos.status,
        priority: todos.priority,
        dueDate: todos.dueDate,
        createdAt: todos.createdAt,
        updatedAt: todos.updatedAt,
        listId: todos.listId,
        listName: todoLists.name,
        recurrenceRuleId: todos.recurrenceRuleId,
        occurrenceNumber: todos.occurrenceNumber,
        recurrenceFrequency: recurrenceRules.frequency,
        recurrenceInterval: recurrenceRules.interval,
      })
      .from(todos)
      .innerJoin(todoLists, eq(todoLists.id, todos.listId))
      .leftJoin(recurrenceRules, eq(recurrenceRules.id, todos.recurrenceRuleId))
      .where(and(...conditions))
      .orderBy(asc(todos.createdAt), asc(todos.id))
      .limit(limit);

    if (rows.length === 0) {
      return { items: [], nextCursor: null };
    }

    const todoIds = rows.map((r) => r.id);
    const doneTodoIds = rows.filter((r) => r.status === "DONE").map((r) => r.id);

    const [tagsMap, completionMap] = await Promise.all([
      this.tagRepo.findTagsForTodos(todoIds),
      this.getVerifiedCompletionTimestamps(listIds, doneTodoIds),
    ]);

    const items: ExportedTodoItem[] = rows.map((row) => {
      const taskTags = (tagsMap.get(row.id) ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
      }));

      const completedDate =
        row.status === "DONE" ? completionMap.get(row.id) ?? null : null;

      return {
        id: row.id,
        title: row.title,
        description: row.description ?? null,
        status: row.status as TodoStatus,
        priority: row.priority as TodoPriority,
        dueDate: row.dueDate ?? null,
        completedAt: completedDate ? completedDate.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        listId: row.listId,
        listName: row.listName,
        tags: taskTags,
        recurrence:
          row.recurrenceRuleId && row.recurrenceFrequency
            ? {
                ruleId: row.recurrenceRuleId,
                occurrenceNumber: row.occurrenceNumber ?? null,
                frequency: row.recurrenceFrequency,
                interval: row.recurrenceInterval ?? 1,
              }
            : null,
      };
    });

    const lastRow = rows[rows.length - 1]!;
    const nextCursor: ExportCursor | null =
      rows.length === limit
        ? { createdAt: lastRow.createdAt, id: lastRow.id }
        : null;

    return { items, nextCursor };
  }

  private async getVerifiedCompletionTimestamps(
    listIds: string[],
    doneTodoIds: string[]
  ): Promise<Map<string, Date>> {
    const map = new Map<string, Date>();
    if (listIds.length === 0 || doneTodoIds.length === 0) {
      return map;
    }

    const rows = await this.db
      .select({
        entityId: activityLogs.entityId,
        completedAt: sql<Date>`max(${activityLogs.createdAt})`,
      })
      .from(activityLogs)
      .where(
        and(
          inArray(activityLogs.listId, listIds),
          inArray(activityLogs.entityId, doneTodoIds),
          sql`(${activityLogs.action} = 'TODO_STATUS_CHANGED' and ${activityLogs.metadata}->>'newStatus' = 'DONE') or (${activityLogs.action} = 'TODO_CREATED' and ${activityLogs.metadata}->>'status' = 'DONE')`
        )
      )
      .groupBy(activityLogs.entityId);

    for (const row of rows) {
      if (row.entityId && row.completedAt) {
        map.set(
          row.entityId,
          row.completedAt instanceof Date ? row.completedAt : new Date(row.completedAt)
        );
      }
    }

    return map;
  }
}

export const analyticsRepository = new AnalyticsRepository();
