import { describe, it, expect, beforeEach } from "vitest";
import {
  AnalyticsService,
  ExportLimitExceededError,
  MAX_EXPORT_TASKS,
} from "@/server/services/analytics.service";
import type {
  IAnalyticsRepository,
  OverviewAggregatesRow,
  VelocityAggregatesRow,
  ExportCursor,
  ExportBatchResult,
} from "@/server/repositories/analytics.repository";
import { ListPermissionService } from "@/server/services/list-permission.service";
import type { ITodoListRepository, TodoListWithTaskCount } from "@/server/repositories/todo-list.repository";
import type { IListMemberRepository } from "@/server/repositories/list-member.repository";
import type { TodoList } from "@/db/schema/lists";
import type { ListMember, ListMemberRole } from "@/db/schema/members";
import { NotFoundError } from "@/server/errors";

const OWNER_ID = "00000000-0000-4000-8000-000000000001";
const EDITOR_ID = "00000000-0000-4000-8000-000000000002";
const VIEWER_ID = "00000000-0000-4000-8000-000000000003";
const STRANGER_ID = "00000000-0000-4000-8000-000000000004";

const LIST_1_ID = "11111111-1111-4111-8111-111111111111";
const LIST_2_ID = "22222222-2222-4222-8222-222222222222";
const FORGED_LIST_ID = "99999999-9999-4999-8999-999999999999";

interface InMemoryTask {
  id: string;
  listId: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string | null;
  tags: { id: string; name: string; color: string }[];
}

interface InMemoryActivity {
  listId: string;
  action: "TODO_CREATED" | "RECURRING_OCCURRENCE_GENERATED" | "RECURRENCE_CREATED" | "TODO_STATUS_CHANGED";
  metadata: Record<string, unknown>;
  createdAt: Date;
}

describe("AnalyticsService — Metric Correctness & Authorization", () => {
  let tasks: InMemoryTask[];
  let activities: InMemoryActivity[];
  let lists: TodoList[];
  let members: ListMember[];
  let exportCountOverride: number | null;
  let lastQueriedListIds: string[];
  let service: AnalyticsService;

  beforeEach(() => {
    tasks = [];
    activities = [];
    exportCountOverride = null;
    lastQueriedListIds = [];

    lists = [
      {
        id: LIST_1_ID,
        userId: OWNER_ID,
        name: "Work List",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: LIST_2_ID,
        userId: STRANGER_ID,
        name: "Stranger Private List",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    ];

    members = [
      {
        id: "m-editor",
        listId: LIST_1_ID,
        userId: EDITOR_ID,
        role: "EDITOR",
        createdAt: new Date("2026-01-02T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
      },
      {
        id: "m-viewer",
        listId: LIST_1_ID,
        userId: VIEWER_ID,
        role: "VIEWER",
        createdAt: new Date("2026-01-02T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
      },
    ];

    const listRepo: ITodoListRepository = {
      async findAllWithTaskCounts(userId: string): Promise<TodoListWithTaskCount[]> {
        const accessible: TodoListWithTaskCount[] = [];
        for (const l of lists) {
          if (l.userId === userId) {
            accessible.push({ ...l, taskCount: 0, effectiveRole: "OWNER" });
          } else {
            const m = members.find((mem) => mem.listId === l.id && mem.userId === userId);
            if (m) {
              accessible.push({
                ...l,
                taskCount: 0,
                effectiveRole: m.role as "EDITOR" | "VIEWER",
              });
            }
          }
        }
        return accessible;
      },
      async findOwnedWithTaskCounts() {
        return [];
      },
      async findSharedWithTaskCounts() {
        return [];
      },
      async findById(id: string) {
        return lists.find((l) => l.id === id) ?? null;
      },
      async create() {
        throw new Error("Not implemented");
      },
      async updateName() {
        return null;
      },
      async delete() {
        return false;
      },
      async countTasksByListId() {
        return 0;
      },
    };

    const memberRepo: IListMemberRepository = {
      async findById(id: string) {
        return members.find((m) => m.id === id) ?? null;
      },
      async findByListAndUser(listId: string, userId: string) {
        return members.find((m) => m.listId === listId && m.userId === userId) ?? null;
      },
      async findAllByListId(listId: string) {
        return members.filter((m) => m.listId === listId);
      },
      async addMember(data) {
        const m: ListMember = {
          id: "new",
          listId: data.listId,
          userId: data.userId,
          role: data.role as ListMemberRole,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        members.push(m);
        return m;
      },
      async updateRole() {
        return null;
      },
      async deleteMember() {
        return false;
      },
      async deleteByListAndUser() {
        return false;
      },
    };

    const analyticsRepo: IAnalyticsRepository = {
      async getOverviewAggregates(listIds: string[], reportingDate: string): Promise<OverviewAggregatesRow> {
        lastQueriedListIds = listIds;
        const scoped = tasks.filter((t) => listIds.includes(t.listId));
        const completedTasks = scoped.filter((t) => t.status === "DONE").length;
        const openTasks = scoped.filter((t) => t.status !== "DONE").length;
        const overdueTasks = scoped.filter(
          (t) => t.status !== "DONE" && t.dueDate !== null && t.dueDate < reportingDate
        ).length;

        const statusCounts = new Map<string, number>();
        const priorityCounts = new Map<string, number>();
        const tagCounts = new Map<string, { tagId: string; name: string; color: string; count: number }>();

        for (const t of scoped) {
          statusCounts.set(t.status, (statusCounts.get(t.status) ?? 0) + 1);
          priorityCounts.set(t.priority, (priorityCounts.get(t.priority) ?? 0) + 1);
          for (const tag of t.tags) {
            const cur = tagCounts.get(tag.id);
            if (cur) cur.count += 1;
            else tagCounts.set(tag.id, { tagId: tag.id, name: tag.name, color: tag.color, count: 1 });
          }
        }

        return {
          totalTasks: scoped.length,
          completedTasks,
          openTasks,
          overdueTasks,
          statusDistribution: Array.from(statusCounts.entries()).map(([status, count]) => ({
            status: status as InMemoryTask["status"],
            count,
          })),
          priorityDistribution: Array.from(priorityCounts.entries()).map(([priority, count]) => ({
            priority: priority as InMemoryTask["priority"],
            count,
          })),
          tagDistribution: Array.from(tagCounts.values()),
        };
      },

      async getWeeklyVelocityAggregates(
        listIds: string[],
        rangeStart: Date,
        rangeEndExclusive: Date
      ): Promise<VelocityAggregatesRow> {
        lastQueriedListIds = listIds;
        const scoped = activities.filter((a) => listIds.includes(a.listId));
        const earliest =
          scoped.length > 0
            ? new Date(Math.min(...scoped.map((a) => a.createdAt.getTime())))
            : null;

        const inRange = scoped.filter(
          (a) =>
            a.createdAt.getTime() >= rangeStart.getTime() &&
            a.createdAt.getTime() < rangeEndExclusive.getTime()
        );

        const bucketMap = new Map<string, { createdCount: number; completedCount: number }>();
        for (const a of inRange) {
          // UTC Monday
          const day = a.createdAt.getUTCDay();
          const diff = day === 0 ? -6 : 1 - day;
          const mon = new Date(
            Date.UTC(
              a.createdAt.getUTCFullYear(),
              a.createdAt.getUTCMonth(),
              a.createdAt.getUTCDate() + diff
            )
          )
            .toISOString()
            .slice(0, 10);

          const cur = bucketMap.get(mon) ?? { createdCount: 0, completedCount: 0 };
          if (
            a.action === "TODO_CREATED" ||
            a.action === "RECURRING_OCCURRENCE_GENERATED" ||
            a.action === "RECURRENCE_CREATED"
          ) {
            cur.createdCount += 1;
          }
          if (
            (a.action === "TODO_STATUS_CHANGED" && a.metadata.newStatus === "DONE") ||
            (a.action === "TODO_CREATED" && a.metadata.status === "DONE")
          ) {
            cur.completedCount += 1;
          }
          bucketMap.set(mon, cur);
        }

        return {
          buckets: Array.from(bucketMap.entries()).map(([weekStart, counts]) => ({
            weekStart,
            createdCount: counts.createdCount,
            completedCount: counts.completedCount,
          })),
          historicalCoverageStart: earliest,
        };
      },

      async countExportableTasks(listIds: string[]) {
        if (exportCountOverride !== null) return exportCountOverride;
        return tasks.filter((t) => listIds.includes(t.listId)).length;
      },

      async getExportBatch(
        _listIds: string[],
        _cursor: ExportCursor | null,
        _limit: number
      ): Promise<ExportBatchResult> {
        return { items: [], nextCursor: null };
      },
    };

    const permissionService = new ListPermissionService(listRepo, memberRepo);
    service = new AnalyticsService(analyticsRepo, listRepo, permissionService);
  });

  describe("A. Overview & Metric Correctness", () => {
    it("returns safe zeroed metrics for an empty dataset", async () => {
      const overview = await service.getOverview(OWNER_ID, LIST_1_ID, new Date("2026-11-25T12:00:00Z"));
      expect(overview.totalTasks).toBe(0);
      expect(overview.completedTasks).toBe(0);
      expect(overview.openTasks).toBe(0);
      expect(overview.overdueTasks).toBe(0);
      expect(overview.currentCompletionRate).toBe(0);
      expect(overview.statusDistribution).toEqual([
        { status: "TODO", count: 0 },
        { status: "IN_PROGRESS", count: 0 },
        { status: "DONE", count: 0 },
      ]);
      expect(overview.priorityDistribution).toEqual([
        { priority: "URGENT", count: 0 },
        { priority: "HIGH", count: 0 },
        { priority: "MEDIUM", count: 0 },
        { priority: "LOW", count: 0 },
      ]);
      expect(overview.tagDistribution).toEqual([]);
    });

    it("accurately evaluates due today, due tomorrow, overdue, and no-due-date tasks", async () => {
      const now = new Date("2026-11-25T10:00:00Z"); // reportingDate = 2026-11-25
      tasks.push(
        // Overdue (TODO, due yesterday) -> overdue
        { id: "t1", listId: LIST_1_ID, status: "TODO", priority: "URGENT", dueDate: "2026-11-24", tags: [] },
        // Due today (IN_PROGRESS) -> NOT overdue
        { id: "t2", listId: LIST_1_ID, status: "IN_PROGRESS", priority: "HIGH", dueDate: "2026-11-25", tags: [] },
        // Due tomorrow (TODO) -> NOT overdue
        { id: "t3", listId: LIST_1_ID, status: "TODO", priority: "MEDIUM", dueDate: "2026-11-26", tags: [] },
        // Done, due in the past -> NOT overdue
        { id: "t4", listId: LIST_1_ID, status: "DONE", priority: "LOW", dueDate: "2026-11-01", tags: [] },
        // No due date -> NOT overdue
        { id: "t5", listId: LIST_1_ID, status: "TODO", priority: "MEDIUM", dueDate: null, tags: [] }
      );

      const overview = await service.getOverview(OWNER_ID, LIST_1_ID, now);
      expect(overview.reportingDate).toBe("2026-11-25");
      expect(overview.totalTasks).toBe(5);
      expect(overview.completedTasks).toBe(1);
      expect(overview.openTasks).toBe(4);
      expect(overview.overdueTasks).toBe(1);
      expect(overview.currentCompletionRate).toBe(20);
    });

    it("counts multi-tag tasks toward each applicable tag without inflating totalTasks", async () => {
      const tagA = { id: "tag-a", name: "Backend", color: "blue" };
      const tagB = { id: "tag-b", name: "Security", color: "red" };
      tasks.push({
        id: "t1",
        listId: LIST_1_ID,
        status: "TODO",
        priority: "HIGH",
        dueDate: null,
        tags: [tagA, tagB],
      });

      const overview = await service.getOverview(OWNER_ID, LIST_1_ID);
      expect(overview.totalTasks).toBe(1);
      expect(overview.tagDistribution).toHaveLength(2);
      expect(overview.tagDistribution.find((t) => t.tagId === "tag-a")?.count).toBe(1);
      expect(overview.tagDistribution.find((t) => t.tagId === "tag-b")?.count).toBe(1);
    });
  });

  describe("B. Historical Velocity vs Current-State Distinction", () => {
    it("distinguishes current completed tasks from historical completion events (reopen, re-complete, deleted tasks, zero weeks)", async () => {
      const now = new Date("2026-11-25T12:00:00Z"); // Wed, week of 2026-11-23
      // Current state: 0 DONE tasks (task was reopened, another was deleted)
      tasks.push({
        id: "t-reopened",
        listId: LIST_1_ID,
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        dueDate: null,
        tags: [],
      });

      // History:
      // Week of 2026-11-16: created, completed, reopened, completed again -> 1 created, 2 completions!
      activities.push(
        { listId: LIST_1_ID, action: "TODO_CREATED", metadata: { status: "TODO" }, createdAt: new Date("2026-11-16T09:00:00Z") },
        { listId: LIST_1_ID, action: "TODO_STATUS_CHANGED", metadata: { previousStatus: "TODO", newStatus: "DONE" }, createdAt: new Date("2026-11-17T10:00:00Z") },
        { listId: LIST_1_ID, action: "TODO_STATUS_CHANGED", metadata: { previousStatus: "DONE", newStatus: "IN_PROGRESS" }, createdAt: new Date("2026-11-18T10:00:00Z") },
        { listId: LIST_1_ID, action: "TODO_STATUS_CHANGED", metadata: { previousStatus: "IN_PROGRESS", newStatus: "DONE" }, createdAt: new Date("2026-11-19T10:00:00Z") },
        // Reopened again before reporting
        { listId: LIST_1_ID, action: "TODO_STATUS_CHANGED", metadata: { previousStatus: "DONE", newStatus: "IN_PROGRESS" }, createdAt: new Date("2026-11-20T10:00:00Z") }
      );
      // Week of 2026-11-23: recurring occurrence generated & completed, then task deleted (activity retained)
      activities.push(
        { listId: LIST_1_ID, action: "RECURRING_OCCURRENCE_GENERATED", metadata: {}, createdAt: new Date("2026-11-23T08:00:00Z") },
        { listId: LIST_1_ID, action: "TODO_STATUS_CHANGED", metadata: { previousStatus: "TODO", newStatus: "DONE" }, createdAt: new Date("2026-11-24T08:00:00Z") }
      );

      const overview = await service.getOverview(OWNER_ID, LIST_1_ID, now);
      const velocity = await service.getVelocity(OWNER_ID, LIST_1_ID, "30d", now);

      // Overview shows 0 currently completed
      expect(overview.completedTasks).toBe(0);
      // Velocity shows 3 historical completion events across the 5 Monday-weeks in 30d (including zero-activity weeks)
      expect(velocity.totalCreated).toBe(2);
      expect(velocity.totalCompletedEvents).toBe(3);
      expect(velocity.weeks).toHaveLength(5);
      expect(velocity.averageWeeklyCompletions).toBe(0.6); // 3 / 5 = 0.6
      expect(velocity.netActivity).toBe(-1); // 2 - 3 = -1
      expect(velocity.historicalCoverageStart).toBe("2026-11-16T09:00:00.000Z");

      const nov16Week = velocity.weeks.find((w) => w.weekStart === "2026-11-16");
      expect(nov16Week?.createdCount).toBe(1);
      expect(nov16Week?.completedCount).toBe(2);

      const zeroWeek = velocity.weeks.find((w) => w.weekStart === "2026-11-02");
      expect(zeroWeek?.createdCount).toBe(0);
      expect(zeroWeek?.completedCount).toBe(0);
    });
  });

  describe("C. Zero-Trust Authorization & Collaboration Security", () => {
    it("allows OWNER, EDITOR, and VIEWER to access list analytics and export preparation", async () => {
      for (const userId of [OWNER_ID, EDITOR_ID, VIEWER_ID]) {
        const overview = await service.getOverview(userId, LIST_1_ID);
        expect(overview.scope.listId).toBe(LIST_1_ID);
        const prep = await service.prepareExport(userId, LIST_1_ID);
        expect(prep.listIds).toEqual([LIST_1_ID]);
      }
    });

    it("denies non-member and forged list IDs with NotFoundError (preventing enumeration)", async () => {
      await expect(service.getOverview(STRANGER_ID, LIST_1_ID)).rejects.toThrow(NotFoundError);
      await expect(service.getVelocity(STRANGER_ID, LIST_1_ID, "90d")).rejects.toThrow(NotFoundError);
      await expect(service.prepareExport(STRANGER_ID, LIST_1_ID)).rejects.toThrow(NotFoundError);
      await expect(service.getOverview(OWNER_ID, FORGED_LIST_ID)).rejects.toThrow(NotFoundError);
    });

    it("excludes inaccessible lists when querying all-accessible-lists scope", async () => {
      tasks.push(
        { id: "t-own", listId: LIST_1_ID, status: "TODO", priority: "LOW", dueDate: null, tags: [] },
        { id: "t-stranger", listId: LIST_2_ID, status: "DONE", priority: "URGENT", dueDate: null, tags: [] }
      );

      const overview = await service.getOverview(VIEWER_ID, null);
      expect(lastQueriedListIds).toEqual([LIST_1_ID]);
      expect(overview.totalTasks).toBe(1);
      expect(overview.completedTasks).toBe(0);
    });

    it("denies subsequent requests immediately after membership revocation", async () => {
      await expect(service.getOverview(VIEWER_ID, LIST_1_ID)).resolves.toBeDefined();

      // Revoke VIEWER_ID membership
      members = members.filter((m) => m.userId !== VIEWER_ID);

      await expect(service.getOverview(VIEWER_ID, LIST_1_ID)).rejects.toThrow(NotFoundError);
      await expect(service.prepareExport(VIEWER_ID, LIST_1_ID)).rejects.toThrow(NotFoundError);
    });

    it("enforces MAX_EXPORT_TASKS limit rather than silently truncating", async () => {
      exportCountOverride = MAX_EXPORT_TASKS + 1;
      await expect(service.prepareExport(OWNER_ID, LIST_1_ID)).rejects.toThrow(
        ExportLimitExceededError
      );
    });
  });
});
