import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  analyticsService,
  EXPORT_BATCH_SIZE,
  ExportLimitExceededError,
} from "@/server/services/analytics.service";
import { exportTodosQuerySchema } from "@/lib/validations/analytics";
import {
  serializeCsvHeaderRow,
  serializeTodoCsvRow,
} from "@/lib/export/csv-serializer";
import { buildJsonExportMetadata } from "@/lib/export/json-serializer";
import { formatUtcDate } from "@/lib/analytics/date-ranges";
import { NotFoundError, ValidationError } from "@/server/errors";
import type { ExportCursor } from "@/server/repositories/analytics.repository";

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user from verified server session
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required to export tasks." },
        { status: 401, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    // 2. Validate query parameters strictly
    const { searchParams } = new URL(request.url);
    const rawFormat = searchParams.get("format");
    const rawListId = searchParams.get("listId");

    const parsed = exportTodosQuerySchema.safeParse({
      format: rawFormat,
      listId: rawListId && rawListId.length > 0 ? rawListId : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid export parameters.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    const { format, listId } = parsed.data;

    // 3. Authorize scope & enforce maximum export size before streaming
    const { listIds, scope, totalTasks } = await analyticsService.prepareExport(
      user.id,
      listId ?? null
    );

    const dateStamp = formatUtcDate(new Date());
    const scopeSlug = scope.type === "list" ? "list" : "all";
    const filename = `caize-todos-${scopeSlug}-${dateStamp}.${format}`;

    const encoder = new TextEncoder();

    if (format === "csv") {
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(`${serializeCsvHeaderRow()}\r\n`));

            let cursor: ExportCursor | null = null;
            do {
              const batch = await analyticsService.getExportBatch(
                listIds,
                cursor,
                EXPORT_BATCH_SIZE
              );

              if (batch.items.length > 0) {
                const chunk =
                  batch.items.map((item) => serializeTodoCsvRow(item)).join("\r\n") +
                  "\r\n";
                controller.enqueue(encoder.encode(chunk));
              }

              cursor = batch.nextCursor;
            } while (cursor !== null);

            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new NextResponse(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store, private",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // JSON streaming with versioned envelope
    const metadata = buildJsonExportMetadata(scope, totalTasks);
    const metaJson = JSON.stringify(metadata, null, 2);
    // Replace closing "}" with `,\n  "tasks": [\n` so we stream items deterministically
    const prefix = metaJson.slice(0, -1) + `,\n  "tasks": [\n`;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(prefix));

          let cursor: ExportCursor | null = null;
          let isFirst = true;

          do {
            const batch = await analyticsService.getExportBatch(
              listIds,
              cursor,
              EXPORT_BATCH_SIZE
            );

            if (batch.items.length > 0) {
              const parts: string[] = [];
              for (const item of batch.items) {
                const serialized = JSON.stringify(item, null, 2)
                  .split("\n")
                  .map((line) => `    ${line}`)
                  .join("\n");
                parts.push(isFirst ? serialized : `,\n${serialized}`);
                isFirst = false;
              }
              controller.enqueue(encoder.encode(parts.join("")));
            }

            cursor = batch.nextCursor;
          } while (cursor !== null);

          controller.enqueue(encoder.encode("\n  ]\n}\n"));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404, headers: { "Cache-Control": "no-store, private" } }
      );
    }
    if (error instanceof ExportLimitExceededError) {
      return NextResponse.json(
        { error: error.message },
        { status: 413, headers: { "Cache-Control": "no-store, private" } }
      );
    }
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    console.error("[ExportTodosError]", error);
    return NextResponse.json(
      { error: "Failed to export tasks." },
      { status: 500, headers: { "Cache-Control": "no-store, private" } }
    );
  }
}
