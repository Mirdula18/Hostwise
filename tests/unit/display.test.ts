import { describe, expect, it } from "vitest";
import { countdown, formatDate, shares, taskProgress } from "../../src/lib/display";

describe("formatDate", () => {
  it("shows weekday, day, month and year", () => {
    expect(formatDate("2026-12-18")).toBe("Fri 18 Dec 2026");
    expect(formatDate("2026-01-05")).toBe("Mon 5 Jan 2026");
  });
});

describe("countdown", () => {
  it("names today, tomorrow and yesterday", () => {
    expect(countdown("2026-11-01", "2026-11-01")).toBe("Today");
    expect(countdown("2026-11-02", "2026-11-01")).toBe("Tomorrow");
    expect(countdown("2026-10-31", "2026-11-01")).toBe("Yesterday");
  });

  it("counts days in both directions", () => {
    expect(countdown("2026-12-18", "2026-10-30")).toBe("49 days to go");
    expect(countdown("2026-10-27", "2026-10-30")).toBe("3 days ago");
  });
});

describe("taskProgress", () => {
  it("is zero for an empty list", () => {
    expect(taskProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it("rounds down so only a finished list reads 100%", () => {
    const tasks = [
      { status: "done" as const },
      { status: "done" as const },
      { status: "todo" as const },
    ];
    expect(taskProgress(tasks)).toEqual({ done: 2, total: 3, percent: 66 });
    expect(taskProgress([{ status: "done" }]).percent).toBe(100);
  });
});

describe("shares", () => {
  it("splits into percents of the whole", () => {
    expect(shares([1, 3])).toEqual([25, 75]);
  });

  it("returns zeros for an empty or zero whole and ignores negatives", () => {
    expect(shares([])).toEqual([]);
    expect(shares([0, 0])).toEqual([0, 0]);
    expect(shares([-5, 10])).toEqual([0, 100]);
  });
});
