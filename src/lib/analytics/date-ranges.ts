import type { AnalyticsRange } from "@/lib/validations/analytics";

export interface ResolvedVelocityDateRange {
  range: AnalyticsRange;
  timezone: "UTC";
  reportingDate: string; // YYYY-MM-DD (UTC)
  rangeStart: Date; // Inclusive UTC midnight
  rangeEndExclusive: Date; // Exclusive UTC midnight (tomorrow 00:00:00.000Z)
  weekStarts: string[]; // Ordered list of YYYY-MM-DD Monday dates in UTC
}

const MONTH_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const MONTH_DAY_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "2-digit",
  timeZone: "UTC",
});

/**
 * Formats a Date into YYYY-MM-DD in UTC without local-timezone drift.
 */
export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Returns the UTC midnight Date for the Monday of the ISO calendar week containing `date`.
 */
export function getUtcMondayStart(date: Date): Date {
  const day = date.getUTCDay(); // 0 (Sun) .. 6 (Sat)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + diffToMonday,
      0,
      0,
      0,
      0
    )
  );
}

/**
 * Formats a Monday YYYY-MM-DD string into a human-readable UTC week label.
 */
export function formatWeekLabel(weekStartIso: string, includeYear = false): string {
  const [yearStr, monthStr, dayStr] = weekStartIso.split("-");
  const d = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr)));
  return includeYear
    ? MONTH_DAY_YEAR_FORMATTER.format(d)
    : MONTH_DAY_FORMATTER.format(d);
}

/**
 * Resolves a reporting range into an explicit UTC half-open interval [rangeStart, rangeEndExclusive)
 * and a complete, zero-gap sequence of Monday-starting calendar week buckets.
 */
export function resolveVelocityDateRange(
  range: AnalyticsRange,
  now: Date = new Date()
): ResolvedVelocityDateRange {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();

  const todayUtcStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const rangeEndExclusive = new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0));

  let rangeStart: Date;
  switch (range) {
    case "7d":
      rangeStart = new Date(Date.UTC(year, month, day - 6, 0, 0, 0, 0));
      break;
    case "30d":
      rangeStart = new Date(Date.UTC(year, month, day - 29, 0, 0, 0, 0));
      break;
    case "90d":
      rangeStart = new Date(Date.UTC(year, month, day - 89, 0, 0, 0, 0));
      break;
    case "12m":
      rangeStart = new Date(Date.UTC(year - 1, month, day, 0, 0, 0, 0));
      break;
  }

  const firstMonday = getUtcMondayStart(rangeStart);
  const lastMonday = getUtcMondayStart(todayUtcStart);

  const weekStarts: string[] = [];
  let cursor = firstMonday;
  while (cursor.getTime() <= lastMonday.getTime()) {
    weekStarts.push(formatUtcDate(cursor));
    cursor = new Date(
      Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate() + 7,
        0,
        0,
        0,
        0
      )
    );
  }

  return {
    range,
    timezone: "UTC",
    reportingDate: formatUtcDate(todayUtcStart),
    rangeStart,
    rangeEndExclusive,
    weekStarts,
  };
}
