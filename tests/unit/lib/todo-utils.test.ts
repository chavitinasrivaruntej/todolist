import { describe, it, expect } from "vitest";
import {
  isTodoOverdue,
  isTodoDueToday,
  formatCalendarDate,
  getLocalTodayDateString,
} from "@/lib/todo-utils";

describe("todo-utils: Overdue & Date Logic", () => {
  const referenceToday = "2026-11-15";
  const pastDate = "2026-11-10";
  const futureDate = "2026-11-20";

  describe("isTodoOverdue", () => {
    it("should mark TODO with past due date as overdue", () => {
      expect(
        isTodoOverdue({ status: "TODO", dueDate: pastDate }, referenceToday)
      ).toBe(true);
    });

    it("should mark IN_PROGRESS with past due date as overdue", () => {
      expect(
        isTodoOverdue({ status: "IN_PROGRESS", dueDate: pastDate }, referenceToday)
      ).toBe(true);
    });

    it("should NEVER mark DONE with past due date as overdue", () => {
      expect(
        isTodoOverdue({ status: "DONE", dueDate: pastDate }, referenceToday)
      ).toBe(false);
    });

    it("should not mark TODO due today as overdue", () => {
      expect(
        isTodoOverdue({ status: "TODO", dueDate: referenceToday }, referenceToday)
      ).toBe(false);
    });

    it("should not mark IN_PROGRESS due today as overdue", () => {
      expect(
        isTodoOverdue({ status: "IN_PROGRESS", dueDate: referenceToday }, referenceToday)
      ).toBe(false);
    });

    it("should not mark task with future due date as overdue", () => {
      expect(
        isTodoOverdue({ status: "TODO", dueDate: futureDate }, referenceToday)
      ).toBe(false);
    });

    it("should NEVER mark task without due date as overdue", () => {
      expect(
        isTodoOverdue({ status: "TODO", dueDate: null }, referenceToday)
      ).toBe(false);
      expect(
        isTodoOverdue({ status: "TODO", dueDate: undefined }, referenceToday)
      ).toBe(false);
    });
  });

  describe("isTodoDueToday", () => {
    it("should return true when dueDate matches referenceToday", () => {
      expect(isTodoDueToday({ dueDate: referenceToday }, referenceToday)).toBe(true);
    });

    it("should return false when dueDate does not match referenceToday", () => {
      expect(isTodoDueToday({ dueDate: pastDate }, referenceToday)).toBe(false);
      expect(isTodoDueToday({ dueDate: futureDate }, referenceToday)).toBe(false);
      expect(isTodoDueToday({ dueDate: null }, referenceToday)).toBe(false);
    });
  });

  describe("formatCalendarDate", () => {
    it("should format ISO YYYY-MM-DD string into readable month day year without timezone shift", () => {
      expect(formatCalendarDate("2026-11-15")).toBe("Nov 15, 2026");
      expect(formatCalendarDate("2026-01-01")).toBe("Jan 1, 2026");
      expect(formatCalendarDate("2026-12-31")).toBe("Dec 31, 2026");
    });

    it("should return empty string when date is missing", () => {
      expect(formatCalendarDate(null)).toBe("");
      expect(formatCalendarDate(undefined)).toBe("");
    });
  });

  describe("getLocalTodayDateString", () => {
    it("should return date string matching YYYY-MM-DD format", () => {
      const today = getLocalTodayDateString();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});

