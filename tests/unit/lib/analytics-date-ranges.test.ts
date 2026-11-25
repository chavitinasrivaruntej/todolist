import { describe, it, expect } from "vitest";
import {
  formatUtcDate,
  getUtcMondayStart,
  resolveVelocityDateRange,
} from "@/lib/analytics/date-ranges";

describe("Analytics Date Ranges & Calendar-Week Buckets (UTC)", () => {
  it("formats UTC dates without local-timezone drift", () => {
    const d = new Date("2026-03-01T23:59:59.999Z");
    expect(formatUtcDate(d)).toBe("2026-03-01");
  });

  it("computes Monday-start UTC week for Sunday, Monday, and mid-week dates", () => {
    // 2026-11-25 is a Wednesday -> Monday is 2026-11-23
    expect(formatUtcDate(getUtcMondayStart(new Date("2026-11-25T18:30:00Z")))).toBe(
      "2026-11-23"
    );
    // Sunday 2026-11-29 -> Monday is 2026-11-23
    expect(formatUtcDate(getUtcMondayStart(new Date("2026-11-29T23:59:59Z")))).toBe(
      "2026-11-23"
    );
    // Monday 2026-11-23 -> Monday is 2026-11-23
    expect(formatUtcDate(getUtcMondayStart(new Date("2026-11-23T00:00:00Z")))).toBe(
      "2026-11-23"
    );
  });

  it("handles month and year boundaries cleanly (Dec 2025 -> Jan 2026)", () => {
    // 2026-01-01 is a Thursday -> Monday of that ISO week is 2025-12-29
    expect(formatUtcDate(getUtcMondayStart(new Date("2026-01-01T12:00:00Z")))).toBe(
      "2025-12-29"
    );
  });

  it("handles leap year Feb 29 -> Mar 1 boundaries cleanly", () => {
    // 2024-02-29 is a Thursday -> Monday is 2024-02-26
    const resolved = resolveVelocityDateRange("7d", new Date("2024-03-02T10:00:00Z"));
    expect(resolved.reportingDate).toBe("2024-03-02");
    expect(resolved.rangeStart.toISOString()).toBe("2024-02-25T00:00:00.000Z");
    expect(resolved.rangeEndExclusive.toISOString()).toBe("2024-03-03T00:00:00.000Z");
    expect(resolved.weekStarts).toEqual(["2024-02-19", "2024-02-26"]);
  });

  it("resolves 7d, 30d, 90d, and 12m half-open intervals with continuous Monday weeks", () => {
    const now = new Date("2026-11-25T15:00:00Z");

    const r7 = resolveVelocityDateRange("7d", now);
    expect(r7.rangeStart.toISOString()).toBe("2026-11-19T00:00:00.000Z");
    expect(r7.rangeEndExclusive.toISOString()).toBe("2026-11-26T00:00:00.000Z");
    expect(r7.weekStarts).toEqual(["2026-11-16", "2026-11-23"]);

    const r30 = resolveVelocityDateRange("30d", now);
    expect(r30.rangeStart.toISOString()).toBe("2026-10-27T00:00:00.000Z");
    expect(r30.weekStarts.length).toBe(5);

    const r90 = resolveVelocityDateRange("90d", now);
    expect(r90.rangeStart.toISOString()).toBe("2026-08-28T00:00:00.000Z");
    expect(r90.weekStarts.length).toBe(14);

    const r12m = resolveVelocityDateRange("12m", now);
    expect(r12m.rangeStart.toISOString()).toBe("2025-11-25T00:00:00.000Z");
    expect(r12m.weekStarts.length).toBe(53);
    expect(r12m.weekStarts[0]).toBe("2025-11-24");
    expect(r12m.weekStarts[r12m.weekStarts.length - 1]).toBe("2026-11-23");
  });
});
