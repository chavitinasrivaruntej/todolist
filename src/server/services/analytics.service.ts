import {
  type IAnalyticsRepository,
  type ExportCursor,
  type ExportBatchResult,
  analyticsRepository as defaultAnalyticsRepo,
} from "@/server/repositories/analytics.repository";
import {
  type ITodoListRepository,
  todoListRepository as defaultListRepo,
} from "@/server/repositories/todo-list.repository";
import {
  ListPermissionService,
  listPermissionService as defaultPermissionService,
} from "@/server/services/list-permission.service";
import {
  formatUtcDate,
  formatWeekLabel,
  resolveVelocityDateRange,
} from "@/lib/analytics/date-ranges";
import type {
  AnalyticsOverviewResult,
  AnalyticsRange,
  AnalyticsScopeInfo,
  AnalyticsVelocityResult,
  WeeklyVelocityPoint,
} from "@/lib/validations/analytics";
import type { TodoPriority, TodoStatus } from "@/db/schema/todos";
import { NotFoundError, ValidationError } from "@/server/errors";

export const MAX_EXPORT_TASKS = 10_000;
export const EXPORT_BATCH_SIZE = 500;

const ORDERED_STATUSES: TodoStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
const ORDERED_PRIORITIES: TodoPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

export class ExportLimitExceededError extends ValidationError {
  public readonly totalTasks: number;
  public readonly maxTasks: number;

  constructor(totalTasks: number, maxTasks: number) {
    super(
      `Export exceeds the maximum limit of ${maxTasks.toLocaleString()} tasks (found ${totalTasks.toLocaleString()}). Please narrow your export to a single list.`
    );
    this.name = "ExportLimitExceededError";
    this.totalTasks = totalTasks;
    this.maxTasks = maxTasks;
  }
}

export class AnalyticsService {
  private readonly analyticsRepo: IAnalyticsRepository;
  private readonly listRepo: ITodoListRepository;
  private readonly permissionService: ListPermissionService;

  constructor(
    analyticsRepo: IAnalyticsRepository = defaultAnalyticsRepo,
    listRepo: ITodoListRepository = defaultListRepo,
    permissionService: ListPermissionService = defaultPermissionService
  ) {
    this.analyticsRepo = analyticsRepo;
    this.listRepo = listRepo;
    this.permissionService = permissionService;
  }

  private async resolveAuthorizedScope(
    userId: string,
    listId?: string | null
  ): Promise<{ listIds: string[]; scope: AnalyticsScopeInfo }> {
    if (listId) {
      await this.permissionService.requireCanReadList(userId, listId);
      const list = await this.listRepo.findById(listId);
      if (!list) {
        throw new NotFoundError(`Todo list with ID ${listId} was not found.`);
      }

      return {
        listIds: [list.id],
        scope: {
          type: "list",
          listId: list.id,
          listName: list.name,
          accessibleListCount: 1,
        },
      };
    }

    const accessibleLists = await this.listRepo.findAllWithTaskCounts(userId);
    return {
      listIds: accessibleLists.map((l) => l.id),
      scope: {
        type: "all-accessible-lists",
        listId: null,
        listName: null,
        accessibleListCount: accessibleLists.length,
      },
    };
  }

  async getOverview(
    userId: string,
    listId?: string | null,
    now: Date = new Date()
  ): Promise<AnalyticsOverviewResult> {
    const { listIds, scope } = await this.resolveAuthorizedScope(userId, listId);
    const reportingDate = formatUtcDate(now);

    const agg = await this.analyticsRepo.getOverviewAggregates(listIds, reportingDate);

    const statusCountMap = new Map<TodoStatus, number>();
    for (const item of agg.statusDistribution) {
      statusCountMap.set(item.status, item.count);
    }

    const priorityCountMap = new Map<TodoPriority, number>();
    for (const item of agg.priorityDistribution) {
      priorityCountMap.set(item.priority, item.count);
    }

    const currentCompletionRate =
      agg.totalTasks > 0
        ? Math.round((agg.completedTasks / agg.totalTasks) * 1000) / 10
        : 0;

    return {
      scope,
      reportingDate,
      reportingTimezone: "UTC",
      totalTasks: agg.totalTasks,
      completedTasks: agg.completedTasks,
      openTasks: agg.openTasks,
      overdueTasks: agg.overdueTasks,
      currentCompletionRate,
      statusDistribution: ORDERED_STATUSES.map((status) => ({
        status,
        count: statusCountMap.get(status) ?? 0,
      })),
      priorityDistribution: ORDERED_PRIORITIES.map((priority) => ({
        priority,
        count: priorityCountMap.get(priority) ?? 0,
      })),
      tagDistribution: agg.tagDistribution,
    };
  }

  async getVelocity(
    userId: string,
    listId?: string | null,
    range: AnalyticsRange = "90d",
    now: Date = new Date()
  ): Promise<AnalyticsVelocityResult> {
    const { listIds, scope } = await this.resolveAuthorizedScope(userId, listId);
    const resolved = resolveVelocityDateRange(range, now);

    const agg = await this.analyticsRepo.getWeeklyVelocityAggregates(
      listIds,
      resolved.rangeStart,
      resolved.rangeEndExclusive
    );

    const bucketMap = new Map<string, { createdCount: number; completedCount: number }>();
    for (const b of agg.buckets) {
      bucketMap.set(b.weekStart, {
        createdCount: b.createdCount,
        completedCount: b.completedCount,
      });
    }

    const includeYear = range === "12m";
    let totalCreated = 0;
    let totalCompletedEvents = 0;

    const weeks: WeeklyVelocityPoint[] = resolved.weekStarts.map((weekStart) => {
      const counts = bucketMap.get(weekStart);
      const createdCount = counts?.createdCount ?? 0;
      const completedCount = counts?.completedCount ?? 0;
      totalCreated += createdCount;
      totalCompletedEvents += completedCount;

      return {
        weekStart,
        weekLabel: formatWeekLabel(weekStart, includeYear),
        createdCount,
        completedCount,
        netActivity: createdCount - completedCount,
      };
    });

    const averageWeeklyCompletions =
      weeks.length > 0
        ? Math.round((totalCompletedEvents / weeks.length) * 100) / 100
        : 0;

    return {
      scope: {
        type: scope.type,
        listId: scope.listId,
        listName: scope.listName,
      },
      range,
      timezone: "UTC",
      rangeStart: resolved.rangeStart.toISOString(),
      rangeEnd: resolved.rangeEndExclusive.toISOString(),
      historicalCoverageStart: agg.historicalCoverageStart
        ? agg.historicalCoverageStart.toISOString()
        : null,
      totalCreated,
      totalCompletedEvents,
      averageWeeklyCompletions,
      netActivity: totalCreated - totalCompletedEvents,
      weeks,
    };
  }

  async prepareExport(
    userId: string,
    listId?: string | null
  ): Promise<{
    listIds: string[];
    scope: AnalyticsScopeInfo;
    totalTasks: number;
  }> {
    const { listIds, scope } = await this.resolveAuthorizedScope(userId, listId);
    const totalTasks = await this.analyticsRepo.countExportableTasks(listIds);

    if (totalTasks > MAX_EXPORT_TASKS) {
      throw new ExportLimitExceededError(totalTasks, MAX_EXPORT_TASKS);
    }

    return {
      listIds,
      scope,
      totalTasks,
    };
  }

  async getExportBatch(
    listIds: string[],
    cursor: ExportCursor | null,
    limit: number = EXPORT_BATCH_SIZE
  ): Promise<ExportBatchResult> {
    return this.analyticsRepo.getExportBatch(listIds, cursor, limit);
  }
}

export const analyticsService = new AnalyticsService();
