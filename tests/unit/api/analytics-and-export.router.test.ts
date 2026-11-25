import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { GET as exportTodosGet } from "@/app/api/exports/todos/route";
import {
  analyticsService,
  ExportLimitExceededError,
  MAX_EXPORT_TASKS,
} from "@/server/services/analytics.service";
import { NotFoundError } from "@/server/errors";
import * as supabaseServer from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import type { ExportedTodoItem } from "@/lib/validations/analytics";

const mockUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "owner@example.com",
} as User;

const LIST_ID = "11111111-1111-4111-8111-111111111111";

describe("Analytics tRPC Router & Export Route Handler", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("tRPC analyticsRouter", () => {
    it("rejects unauthenticated requests to getOverview and getVelocity", async () => {
      const ctx = await createTRPCContext({ user: null });
      const caller = appRouter.createCaller(ctx);

      await expect(caller.analytics.getOverview()).rejects.toThrow(
        "You must be logged in to perform this action."
      );
      await expect(caller.analytics.getVelocity({ range: "30d" })).rejects.toThrow(
        "You must be logged in to perform this action."
      );
    });

    it("delegates authenticated getOverview and getVelocity using ctx.user.id", async () => {
      const overviewSpy = vi
        .spyOn(analyticsService, "getOverview")
        .mockResolvedValue({
          scope: {
            type: "all-accessible-lists",
            listId: null,
            listName: null,
            accessibleListCount: 2,
          },
          reportingDate: "2026-11-25",
          reportingTimezone: "UTC",
          totalTasks: 4,
          completedTasks: 2,
          openTasks: 2,
          overdueTasks: 1,
          currentCompletionRate: 50,
          statusDistribution: [
            { status: "TODO", count: 1 },
            { status: "IN_PROGRESS", count: 1 },
            { status: "DONE", count: 2 },
          ],
          priorityDistribution: [
            { priority: "URGENT", count: 1 },
            { priority: "HIGH", count: 1 },
            { priority: "MEDIUM", count: 2 },
            { priority: "LOW", count: 0 },
          ],
          tagDistribution: [],
        });

      const velocitySpy = vi
        .spyOn(analyticsService, "getVelocity")
        .mockResolvedValue({
          scope: {
            type: "list",
            listId: LIST_ID,
            listName: "Work",
          },
          range: "30d",
          timezone: "UTC",
          rangeStart: "2026-10-27T00:00:00.000Z",
          rangeEnd: "2026-11-26T00:00:00.000Z",
          historicalCoverageStart: null,
          totalCreated: 2,
          totalCompletedEvents: 1,
          averageWeeklyCompletions: 0.2,
          netActivity: 1,
          weeks: [],
        });

      const ctx = await createTRPCContext({ user: mockUser });
      const caller = appRouter.createCaller(ctx);

      const overview = await caller.analytics.getOverview();
      expect(overview.totalTasks).toBe(4);
      expect(overviewSpy).toHaveBeenCalledWith(mockUser.id, null);

      const velocity = await caller.analytics.getVelocity({
        listId: LIST_ID,
        range: "30d",
      });
      expect(velocity.range).toBe("30d");
      expect(velocitySpy).toHaveBeenCalledWith(mockUser.id, LIST_ID, "30d");
    });
  });

  describe("GET /api/exports/todos Route Handler", () => {
    const mockAuthUser = (user: User | null) => {
      vi.spyOn(supabaseServer, "createClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user },
            error: user ? null : new Error("No session"),
          }),
        },
      } as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>);
    };

    it("returns 401 when unauthenticated", async () => {
      mockAuthUser(null);
      const req = new NextRequest("http://localhost:3000/api/exports/todos?format=csv");
      const res = await exportTodosGet(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid format or forged non-UUID listId", async () => {
      mockAuthUser(mockUser);
      const badFormatReq = new NextRequest(
        "http://localhost:3000/api/exports/todos?format=xlsx"
      );
      expect((await exportTodosGet(badFormatReq)).status).toBe(400);

      const badListReq = new NextRequest(
        "http://localhost:3000/api/exports/todos?format=csv&listId=not-a-uuid"
      );
      expect((await exportTodosGet(badListReq)).status).toBe(400);
    });

    it("returns 404 when user lacks access to requested list", async () => {
      mockAuthUser(mockUser);
      vi.spyOn(analyticsService, "prepareExport").mockRejectedValue(
        new NotFoundError("List not found")
      );

      const req = new NextRequest(
        `http://localhost:3000/api/exports/todos?format=json&listId=${LIST_ID}`
      );
      const res = await exportTodosGet(req);
      expect(res.status).toBe(404);
    });

    it("returns 413 when export exceeds MAX_EXPORT_TASKS", async () => {
      mockAuthUser(mockUser);
      vi.spyOn(analyticsService, "prepareExport").mockRejectedValue(
        new ExportLimitExceededError(MAX_EXPORT_TASKS + 10, MAX_EXPORT_TASKS)
      );

      const req = new NextRequest("http://localhost:3000/api/exports/todos?format=csv");
      const res = await exportTodosGet(req);
      expect(res.status).toBe(413);
    });

    it("streams multi-batch CSV with safe headers, formula mitigation, and no secrets", async () => {
      mockAuthUser(mockUser);
      vi.spyOn(analyticsService, "prepareExport").mockResolvedValue({
        listIds: [LIST_ID],
        scope: {
          type: "list",
          listId: LIST_ID,
          listName: "Work\r\nInjectedHeader: evil",
          accessibleListCount: 1,
        },
        totalTasks: 2,
      });

      const item1: ExportedTodoItem = {
        id: "t1",
        title: "=CMD('calc')",
        description: 'Note with, comma and "quote"',
        status: "DONE",
        priority: "HIGH",
        dueDate: "2026-11-30",
        completedAt: "2026-11-25T10:00:00.000Z",
        createdAt: "2026-11-20T10:00:00.000Z",
        updatedAt: "2026-11-25T10:00:00.000Z",
        listId: LIST_ID,
        listName: "Work",
        tags: [],
        recurrence: null,
      };
      const item2: ExportedTodoItem = {
        ...item1,
        id: "t2",
        title: "Normal task",
        status: "TODO",
        completedAt: null,
      };

      const batchSpy = vi
        .spyOn(analyticsService, "getExportBatch")
        .mockResolvedValueOnce({
          items: [item1],
          nextCursor: { createdAt: new Date("2026-11-20T10:00:00.000Z"), id: "t1" },
        })
        .mockResolvedValueOnce({
          items: [item2],
          nextCursor: null,
        });

      const req = new NextRequest(
        `http://localhost:3000/api/exports/todos?format=csv&listId=${LIST_ID}`
      );
      const res = await exportTodosGet(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
      // Server-controlled filename ignores user-controlled listName
      expect(res.headers.get("Content-Disposition")).toMatch(
        /^attachment; filename="caize-todos-list-\d{4}-\d{2}-\d{2}\.csv"$/
      );
      expect(res.headers.get("Cache-Control")).toBe("no-store, private");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");

      const body = await res.text();
      expect(batchSpy).toHaveBeenCalledTimes(2);
      expect(body).toContain('"\'=CMD(\'calc\')"');
      expect(body).toContain('"Normal task"');
      expect(body).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    });

    it("streams valid versioned JSON envelope with empty or populated tasks", async () => {
      mockAuthUser(mockUser);
      vi.spyOn(analyticsService, "prepareExport").mockResolvedValue({
        listIds: [],
        scope: {
          type: "all-accessible-lists",
          listId: null,
          listName: null,
          accessibleListCount: 0,
        },
        totalTasks: 0,
      });
      vi.spyOn(analyticsService, "getExportBatch").mockResolvedValue({
        items: [],
        nextCursor: null,
      });

      const req = new NextRequest("http://localhost:3000/api/exports/todos?format=json");
      const res = await exportTodosGet(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");

      const parsed = JSON.parse(await res.text());
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.scope).toEqual({ type: "all-accessible-lists" });
      expect(parsed.totalTasks).toBe(0);
      expect(parsed.tasks).toEqual([]);
    });
  });
});
