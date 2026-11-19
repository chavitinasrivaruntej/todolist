import { describe, it, expect } from "vitest";
import {
  calculateNextOccurrence,
  isLeapYear,
  getDaysInMonth,
  formatIsoDate,
  parseIsoDate,
  getIsoDayOfWeek,
  addDaysToIsoDate,
  type RecurrenceRuleConfig,
} from "@/lib/recurrence-engine";

describe("Recurrence Engine", () => {
  describe("Helper Functions", () => {
    it("should correctly identify leap years", () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2028)).toBe(true);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(1900)).toBe(false);
      expect(isLeapYear(2025)).toBe(false);
      expect(isLeapYear(2026)).toBe(false);
    });

    it("should return correct days in month including leap years", () => {
      expect(getDaysInMonth(2024, 2)).toBe(29);
      expect(getDaysInMonth(2025, 2)).toBe(28);
      expect(getDaysInMonth(2026, 1)).toBe(31);
      expect(getDaysInMonth(2026, 4)).toBe(30);
    });

    it("should correctly determine ISO day of week (1=Mon ... 7=Sun)", () => {
      // 2026-11-16 is Monday
      expect(getIsoDayOfWeek("2026-11-16")).toBe(1);
      // 2026-11-20 is Friday
      expect(getIsoDayOfWeek("2026-11-20")).toBe(5);
      // 2026-11-22 is Sunday
      expect(getIsoDayOfWeek("2026-11-22")).toBe(7);
    });
  });

  describe("Daily Recurrence", () => {
    it("should calculate next occurrence for every 1 day", () => {
      const config: RecurrenceRuleConfig = {
        frequency: "DAILY",
        interval: 1,
        startDate: "2026-11-01",
      };
      expect(calculateNextOccurrence(config, "2026-11-01", 1)).toBe("2026-11-02");
      expect(calculateNextOccurrence(config, "2026-11-30", 30)).toBe("2026-12-01");
    });

    it("should calculate next occurrence for every 3 days across month boundary", () => {
      const config: RecurrenceRuleConfig = {
        frequency: "DAILY",
        interval: 3,
        startDate: "2026-11-29",
      };
      expect(calculateNextOccurrence(config, "2026-11-29", 1)).toBe("2026-12-02");
    });
  });

  describe("Weekly Recurrence & Anchor Drift Prevention", () => {
    it("should calculate next occurrence for every week on Monday", () => {
      const config: RecurrenceRuleConfig = {
        frequency: "WEEKLY",
        interval: 1,
        daysOfWeek: [1], // Monday
        startDate: "2026-11-16", // Monday
      };
      expect(calculateNextOccurrence(config, "2026-11-16", 1)).toBe("2026-11-23");
      expect(calculateNextOccurrence(config, "2026-11-23", 2)).toBe("2026-11-30");
    });

    it("should calculate next occurrence for every week on Monday and Friday", () => {
      const config: RecurrenceRuleConfig = {
        frequency: "WEEKLY",
        interval: 1,
        daysOfWeek: [1, 5], // Mon, Fri
        startDate: "2026-11-16", // Mon
      };
      // From Monday -> next is Friday of same week
      expect(calculateNextOccurrence(config, "2026-11-16", 1)).toBe("2026-11-20");
      // From Friday -> next is Monday of following week
      expect(calculateNextOccurrence(config, "2026-11-20", 2)).toBe("2026-11-23");
      // From Monday again -> next is Friday
      expect(calculateNextOccurrence(config, "2026-11-23", 3)).toBe("2026-11-27");
    });

    it("should calculate next occurrence for every 2 weeks on Monday and Friday without drifting", () => {
      const config: RecurrenceRuleConfig = {
        frequency: "WEEKLY",
        interval: 2,
        daysOfWeek: [1, 5], // Mon, Fri
        startDate: "2026-11-16", // Mon (Week 1)
      };
      // 1. Mon, Week 1 (Nov 16) -> Fri, Week 1 (Nov 20)
      const occ2 = calculateNextOccurrence(config, "2026-11-16", 1);
      expect(occ2).toBe("2026-11-20");

      // 2. Fri, Week 1 (Nov 20) -> Mon, Week 3 (Nov 30)! (Skips Week 2)
      const occ3 = calculateNextOccurrence(config, "2026-11-20", 2);
      expect(occ3).toBe("2026-11-30");

      // 3. Mon, Week 3 (Nov 30) -> Fri, Week 3 (Dec 04)
      const occ4 = calculateNextOccurrence(config, "2026-11-30", 3);
      expect(occ4).toBe("2026-12-04");

      // 4. Fri, Week 3 (Dec 04) -> Mon, Week 5 (Dec 14)!
      const occ5 = calculateNextOccurrence(config, "2026-12-04", 4);
      expect(occ5).toBe("2026-12-14");
    });

    it("should calculate next occurrence for every 3 weeks on Tue and Thu", () => {
      const config: RecurrenceRuleConfig = {
        frequency: "WEEKLY",
        interval: 3,
        daysOfWeek: [2, 4], // Tue, Thu
        startDate: "2026-11-17", // Tue (Week 1)
      };
      // Tue, Week 1 (Nov 17) -> Thu, Week 1 (Nov 19)
      expect(calculateNextOccurrence(config, "2026-11-17", 1)).toBe("2026-11-19");
      // Thu, Week 1 (Nov 19) -> Tue, Week 4 (Dec 08) (3 weeks later!)
      expect(calculateNextOccurrence(config, "2026-11-19", 2)).toBe("2026-12-08");
    });
  });

  describe("Monthly Recurrence & Target Preservation", () => {
    it("should preserve original target day (31st) across Feb and March", () => {
      const config: RecurrenceRuleConfig = {
        frequency: "MONTHLY",
        interval: 1,
        anchorDayOfMonth: 31,
        startDate: "2025-01-31",
      };
      // Jan 31 -> Feb 28 (clamped in non-leap year 2025)
      const feb = calculateNextOccurrence(config, "2025-01-31", 1);
      expect(feb).toBe("2025-02-28");

      // Feb 28 -> March 31! (Restores anchor 31st, not stuck on 28th!)
      const mar = calculateNextOccurrence(config, feb!, 2);
      expect(mar).toBe("2025-03-31");

      // March 31 -> April 30 (clamped to 30)
      const apr = calculateNextOccurrence(config, mar!, 3);
      expect(apr).toBe("2025-04-30");

      // April 30 -> May 31! (Restores anchor 31st!)
      const may = calculateNextOccurrence(config, apr!, 4);
      expect(may).toBe("2025-05-31");
    });

    it("should preserve original target day (31st) in leap year 2028 (Feb 29)", () => {
      const config: RecurrenceRuleConfig = {
        frequency: "MONTHLY",
        interval: 1,
        anchorDayOfMonth: 31,
        startDate: "2028-01-31",
      };
      // Jan 31 -> Feb 29 (clamped to 29 in leap year 2028)
      const feb = calculateNextOccurrence(config, "2028-01-31", 1);
      expect(feb).toBe("2028-02-29");

      // Feb 29 -> March 31 (restores anchor 31st)
      const mar = calculateNextOccurrence(config, feb!, 2);
      expect(mar).toBe("2028-03-31");
    });

    it("should calculate quarterly recurrence (every 3 months) preserving day 31", () => {
      const config: RecurrenceRuleConfig = {
        frequency: "MONTHLY",
        interval: 3,
        anchorDayOfMonth: 31,
        startDate: "2026-01-31",
      };
      // Jan 31 -> Apr 30 (3 months, clamped to 30)
      const apr = calculateNextOccurrence(config, "2026-01-31", 1);
      expect(apr).toBe("2026-04-30");

      // Apr 30 -> Jul 31 (3 months, restored to 31)
      const jul = calculateNextOccurrence(config, apr!, 2);
      expect(jul).toBe("2026-07-31");

      // Jul 31 -> Oct 31 (3 months)
      const oct = calculateNextOccurrence(config, jul!, 3);
      expect(oct).toBe("2026-10-31");
    });
  });

  describe("Yearly Recurrence & Leap Year Boundaries", () => {
    it("should preserve Feb 29 leap-year anchor across non-leap years and restore on next leap year", () => {
      const config: RecurrenceRuleConfig = {
        frequency: "YEARLY",
        interval: 1,
        anchorMonthOfYear: 2,
        anchorDayOfMonth: 29,
        startDate: "2028-02-29", // 2028 is leap
      };
      // 2028-02-29 -> 2029-02-28 (non-leap year, clamped to 28)
      const y2029 = calculateNextOccurrence(config, "2028-02-29", 1);
      expect(y2029).toBe("2029-02-28");

      // 2029-02-28 -> 2030-02-28 (non-leap year)
      const y2030 = calculateNextOccurrence(config, y2029!, 2);
      expect(y2030).toBe("2030-02-28");

      // 2030-02-28 -> 2031-02-28 (non-leap year)
      const y2031 = calculateNextOccurrence(config, y2030!, 3);
      expect(y2031).toBe("2031-02-28");

      // 2031-02-28 -> 2032-02-29! (2032 is leap year, returns to Feb 29!)
      const y2032 = calculateNextOccurrence(config, y2031!, 4);
      expect(y2032).toBe("2032-02-29");
    });
  });

  describe("Termination Boundaries (End Date & Max Occurrences)", () => {
    it("should return null when max occurrences limit is reached", () => {
      const config: RecurrenceRuleConfig = {
        frequency: "DAILY",
        interval: 1,
        startDate: "2026-11-01",
        maxOccurrences: 3,
      };
      expect(calculateNextOccurrence(config, "2026-11-01", 1)).toBe("2026-11-02");
      expect(calculateNextOccurrence(config, "2026-11-02", 2)).toBe("2026-11-03");
      // Occurrence 3 reached -> next is null
      expect(calculateNextOccurrence(config, "2026-11-03", 3)).toBeNull();
    });

    it("should return null when next date exceeds end date", () => {
      const config: RecurrenceRuleConfig = {
        frequency: "WEEKLY",
        interval: 1,
        daysOfWeek: [1],
        startDate: "2026-11-16",
        endDate: "2026-11-25",
      };
      // Next is Nov 23 (<= Nov 25)
      expect(calculateNextOccurrence(config, "2026-11-16", 1)).toBe("2026-11-23");
      // Next after Nov 23 would be Nov 30 (> Nov 25) -> null
      expect(calculateNextOccurrence(config, "2026-11-23", 2)).toBeNull();
    });
  });
});
