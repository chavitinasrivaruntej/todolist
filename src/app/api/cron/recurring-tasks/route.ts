import { NextRequest, NextResponse } from "next/server";
import { recurrenceService } from "@/server/services/recurrence.service";

/**
 * Background recurring task sweeper endpoint.
 * Intended to be invoked periodically (e.g. daily at 00:01 UTC) via Vercel Cron or external scheduler.
 * Authenticated via CRON_SECRET bearer token or query parameter.
 */
export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // Authorization check
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const queryToken = req.nextUrl.searchParams.get("token");

  const providedToken = bearerToken || queryToken;

  if (cronSecret && providedToken !== cronSecret) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing cron secret token." },
      { status: 401 }
    );
  }

  // If in production and no CRON_SECRET is configured, reject for security
  if (!cronSecret && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Server configuration error: CRON_SECRET is not configured." },
      { status: 500 }
    );
  }

  try {
    const result = await recurrenceService.processDueRecurrences();
    return NextResponse.json({
      success: true,
      processed: result.processed,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { error: "Failed to process due recurring tasks.", details: message },
      { status: 500 }
    );
  }
}
