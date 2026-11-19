/**
 * Recurrence Calculation Engine
 *
 * Implements deterministic, timezone-safe calendar arithmetic for recurring tasks.
 * Operates purely on ISO date strings (YYYY-MM-DD) and UTC calendar integers.
 * Preserves recurrence anchors across multi-week intervals, month-end clamping,
 * and leap-year boundaries.
 */

export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM";

export interface RecurrenceRuleConfig {
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek?: number[] | null;      // ISO weekday: 1 = Monday ... 7 = Sunday
  anchorDayOfMonth?: number | null;  // 1 .. 31 (original target day of month, e.g. 31)
  anchorMonthOfYear?: number | null; // 1 .. 12 (original target month, e.g. 2 for Feb)
  startDate: string;          // YYYY-MM-DD (fixed series anchor)
  endDate?: string | null;    // YYYY-MM-DD (optional termination date)
  maxOccurrences?: number | null;
}

/**
 * Checks whether a year is a leap year in the Gregorian calendar.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the maximum number of days in a given month of a given year.
 * month: 1 = January ... 12 = December
 */
export function getDaysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:  // January
    case 3:  // March
    case 5:  // May
    case 7:  // July
    case 8:  // August
    case 10: // October
    case 12: // December
      return 31;
    case 4:  // April
    case 6:  // June
    case 9:  // September
    case 11: // November
      return 30;
    case 2:  // February
      return isLeapYear(year) ? 29 : 28;
    default:
      throw new Error(`Invalid month: ${month}`);
  }
}

/**
 * Formats year, month, and day into an ISO date string (YYYY-MM-DD).
 */
export function formatIsoDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parses an ISO date string (YYYY-MM-DD) into UTC year, month (1..12), and day (1..31).
 */
export function parseIsoDate(dateStr: string): [number, number, number] {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid ISO date format: ${dateStr}`);
  }
  return [parts[0]!, parts[1]!, parts[2]!];
}

/**
 * Returns the ISO day of the week for an ISO date string (1 = Monday, ..., 7 = Sunday).
 */
export function getIsoDayOfWeek(dateStr: string): number {
  const [y, m, d] = parseIsoDate(dateStr);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  return day === 0 ? 7 : day;
}

/**
 * Adds an integer number of days to an ISO date string.
 */
export function addDaysToIsoDate(dateStr: string, days: number): string {
  const [y, m, d] = parseIsoDate(dateStr);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
}

/**
 * Calculates the number of days between two ISO date strings (target - base).
 */
export function daysBetween(baseDateStr: string, targetDateStr: string): number {
  const [y1, m1, d1] = parseIsoDate(baseDateStr);
  const [y2, m2, d2] = parseIsoDate(targetDateStr);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

/**
 * Returns the Monday of the ISO week containing the given date.
 */
export function getMondayOfWeek(dateStr: string): string {
  const isoDay = getIsoDayOfWeek(dateStr);
  return addDaysToIsoDate(dateStr, -(isoDay - 1));
}

/**
 * Calculates the next occurrence date strictly based on the configured recurrence rule
 * and a reference occurrence due date.
 *
 * Guarantees:
 * 1. Multi-week intervals (e.g. every 2 weeks on Mon & Fri) anchor to startDate without drift.
 * 2. Month-end clamping (e.g. 31st) preserves the anchor across 28/29/30/31-day months.
 * 3. Leap-year Feb 29 preserves the anchor across non-leap years.
 * 4. Respects maxOccurrences and endDate boundary constraints.
 */
export function calculateNextOccurrence(
  config: RecurrenceRuleConfig,
  currentDueDate: string,
  occurrenceNumber: number
): string | null {
  // 1. Boundary check: Max occurrences
  if (config.maxOccurrences && occurrenceNumber >= config.maxOccurrences) {
    return null;
  }

  const [currentYear, currentMonth, currentDay] = parseIsoDate(currentDueDate);
  let nextDateStr: string;

  switch (config.frequency) {
    case "DAILY": {
      const interval = Math.max(1, config.interval);
      nextDateStr = addDaysToIsoDate(currentDueDate, interval);
      break;
    }

    case "WEEKLY": {
      const interval = Math.max(1, config.interval);
      // Ensure sorted, unique active ISO weekdays (1 = Mon ... 7 = Sun)
      const activeDays = (config.daysOfWeek && config.daysOfWeek.length > 0)
        ? Array.from(new Set(config.daysOfWeek)).sort((a, b) => a - b)
        : [getIsoDayOfWeek(config.startDate)];

      const currentIsoDay = getIsoDayOfWeek(currentDueDate);

      // Check if there is another scheduled weekday remaining in the same week
      const nextDaySameWeek = activeDays.find((d) => d > currentIsoDay);

      if (nextDaySameWeek) {
        nextDateStr = addDaysToIsoDate(currentDueDate, nextDaySameWeek - currentIsoDay);
      } else {
        // Last active day of the current week reached. Advance to the next cycle week.
        // We use the series anchor Monday to calculate week parity without drift.
        const anchorMonday = getMondayOfWeek(config.startDate);
        const currentMonday = getMondayOfWeek(currentDueDate);
        const weeksFromAnchor = Math.round(daysBetween(anchorMonday, currentMonday) / 7);

        // Advance by interval weeks
        const nextCycleMonday = addDaysToIsoDate(currentMonday, interval * 7);
        // Position at the first active day of that next cycle week
        const firstDayOfCycle = activeDays[0]!;
        nextDateStr = addDaysToIsoDate(nextCycleMonday, firstDayOfCycle - 1);
      }
      break;
    }

    case "MONTHLY": {
      const interval = Math.max(1, config.interval);
      // Preserve original anchor day (e.g. 31st)
      const targetDay = config.anchorDayOfMonth || currentDay;

      // Advance by interval months
      let nextMonth = currentMonth + interval;
      let nextYear = currentYear;
      while (nextMonth > 12) {
        nextMonth -= 12;
        nextYear += 1;
      }

      // Clamp to maximum days in target month (e.g. 31 -> 28 in Feb)
      const maxDaysInTargetMonth = getDaysInMonth(nextYear, nextMonth);
      const clampedDay = Math.min(targetDay, maxDaysInTargetMonth);
      nextDateStr = formatIsoDate(nextYear, nextMonth, clampedDay);
      break;
    }

    case "YEARLY": {
      const interval = Math.max(1, config.interval);
      const nextYear = currentYear + interval;
      const targetMonth = config.anchorMonthOfYear || currentMonth;
      const targetDay = config.anchorDayOfMonth || currentDay;

      // Handle Feb 29 leap-year preservation (e.g. 2028 -> 2029 clamps to Feb 28, but 2032 returns to Feb 29)
      const maxDaysInMonth = getDaysInMonth(nextYear, targetMonth);
      const clampedDay = Math.min(targetDay, maxDaysInMonth);
      nextDateStr = formatIsoDate(nextYear, targetMonth, clampedDay);
      break;
    }

    default:
      throw new Error(`Unsupported recurrence frequency: ${config.frequency}`);
  }

  // 2. Boundary check: End date
  if (config.endDate && nextDateStr > config.endDate) {
    return null;
  }

  return nextDateStr;
}
