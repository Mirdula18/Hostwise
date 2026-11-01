import {
  fromPercents,
  normalisePercents,
  rebalance,
  scaleForGuests,
  setLineAmount,
  setSpent,
  toggleLock,
} from "../../src/lib/budget";
import { lineStatus, summary } from "../../src/lib/budgetStatus";
import { counterIds } from "../../src/lib/id";
import { sum } from "../../src/lib/money";
import type { Priority } from "../../src/schemas/event";
import { allocatedSum, event, line } from "./fixtures";

const priorities: Priority[] = ["food", "guest_comfort", "venue"];

describe("normalisePercents", () => {
  it("makes [30,30,30] sum to 100", () => {
    expect(sum(normalisePercents([30, 30, 30]))).toBe(100);
  });
  it("handles empty input and percents that over-shoot", () => {
    expect(normalisePercents([])).toEqual([]);
    expect(sum(normalisePercents([60, 60]))).toBe(100);
  });
});

describe("fromPercents", () => {
  it("produces amounts that sum exactly to the total", () => {
    const lines = fromPercents(
      [
        { category: "Catering", percent: 33, perGuest: true },
        { category: "Venue", percent: 33, perGuest: false, priorityTag: "venue", rationale: "Why" },
        { category: "Misc", percent: 33, perGuest: false },
      ],
      1_000_001,
      counterIds(),
    );
    expect(allocatedSum(lines)).toBe(1_000_001);
    expect(lines.every((l) => l.source === "estimate" && !l.locked)).toBe(true);
    expect(lines[0]?.priorityTag).toBe("food");
    expect(lines[1]?.rationale).toBe("Why");
    expect(lines[2]?.priorityTag).toBeUndefined();
    expect(lines.map((l) => l.id)).toEqual(["line_1", "line_2", "line_3"]);
  });

  it("returns no lines for no items", () => {
    expect(fromPercents([], 1000)).toEqual([]);
  });
});

describe("rebalance", () => {
  const base = event().budget;

  it("takes from the lowest-priority unlocked lines first", () => {
    const r = rebalance(base, "food", 50_000, priorities);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const by = Object.fromEntries(r.value.map((l) => [l.id, l.allocated]));
    // Decor (15k) and favours (10k) are both unranked; the bigger line gives first.
    expect(by).toMatchObject({
      food: 50_000,
      decor: 5_000,
      favours: 10_000,
      venue: 25_000,
      comfort: 10_000,
    });
    expect(allocatedSum(r.value)).toBe(100_000);
    expect(r.value.find((l) => l.id === "food")?.source).toBe("user");
  });

  it("never takes from locked lines", () => {
    const locked = base.map((l) => (l.id === "decor" ? { ...l, locked: true } : l));
    const r = rebalance(locked, "food", 50_000, priorities);
    expect(r.ok && r.value.find((l) => l.id === "decor")?.allocated).toBe(15_000);
    expect(r.ok && r.value.find((l) => l.id === "favours")?.allocated).toBe(0);
  });

  it("returns an error when unlocked lines cannot cover the raise", () => {
    const locked = base.map((l) => (l.id === "food" ? l : { ...l, locked: true }));
    expect(rebalance(locked, "food", 50_000, priorities)).toEqual({
      ok: false,
      error: { kind: "insufficient_unlocked", shortBy: 10_000 },
    });
  });

  it("never produces negative values, even when raising a lot", () => {
    const r = rebalance(base, "food", 100_000, priorities);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.every((l) => l.allocated >= 0)).toBe(true);
      expect(allocatedSum(r.value)).toBe(100_000);
    }
    expect(rebalance(base, "food", 100_001, priorities).ok).toBe(false);
  });

  it("shares money freed by a cut by priority weight", () => {
    const r = rebalance(base, "decor", 5_000, priorities);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const by = Object.fromEntries(r.value.map((l) => [l.id, l.allocated]));
    expect(by.food).toBeGreaterThan(40_000);
    expect((by.food ?? 0) - 40_000).toBeGreaterThan((by.venue ?? 0) - 25_000);
    expect(allocatedSum(r.value)).toBe(100_000);
  });

  it("is a no-op when the amount does not change", () => {
    const r = rebalance(base, "venue", 25_000, priorities);
    expect(r.ok && allocatedSum(r.value)).toBe(100_000);
  });

  it("rejects unknown ids, negatives and amounts below what is committed", () => {
    expect(rebalance(base, "nope", 1, priorities)).toEqual({
      ok: false,
      error: { kind: "not_found" },
    });
    expect(rebalance(base, "food", -1, priorities)).toEqual({
      ok: false,
      error: { kind: "negative" },
    });
    const committed = base.map((l) => (l.id === "food" ? { ...l, committed: 30_000 } : l));
    expect(rebalance(committed, "food", 20_000, priorities)).toEqual({
      ok: false,
      error: { kind: "below_committed", minimum: 30_000 },
    });
  });

  it("rejects a cut when every other line is locked", () => {
    const locked = base.map((l) => (l.id === "food" ? l : { ...l, locked: true }));
    expect(rebalance(locked, "food", 10_000, priorities)).toEqual({
      ok: false,
      error: { kind: "no_unlocked" },
    });
  });

  it("keeps a quote source on an edited quoted line", () => {
    const quoted = base.map((l) => (l.id === "food" ? { ...l, source: "quote" as const } : l));
    const r = rebalance(quoted, "food", 41_000, priorities);
    expect(r.ok && r.value.find((l) => l.id === "food")?.source).toBe("quote");
  });
});

describe("setLineAmount", () => {
  it("changes one line and reports the new total", () => {
    const r = setLineAmount(event().budget, "decor", 20_000);
    expect(r.ok && r.value.total).toBe(105_000);
    expect(r.ok && r.value.lines.find((l) => l.id === "decor")?.source).toBe("user");
  });
  it("rejects unknown ids, negatives and amounts below spending", () => {
    const lines = event().budget;
    expect(setLineAmount(lines, "x", 1).ok).toBe(false);
    expect(setLineAmount(lines, "decor", -5).ok).toBe(false);
    const spent = lines.map((l) => (l.id === "decor" ? { ...l, spent: 9_000 } : l));
    expect(setLineAmount(spent, "decor", 1_000).ok).toBe(false);
  });
});

describe("scaleForGuests", () => {
  const base = event().budget;

  it("scales only per-guest lines by 80/60", () => {
    const scaled = scaleForGuests(base, 60, 80);
    const by = Object.fromEntries(scaled.map((l) => [l.id, l.allocated]));
    expect(by).toEqual({
      food: 53_333,
      venue: 25_000,
      comfort: 13_333,
      decor: 15_000,
      favours: 13_333,
    });
    expect(scaled.find((l) => l.id === "venue")).toBe(base.find((l) => l.id === "venue"));
  });

  it("is a no-op for the same count", () => {
    expect(scaleForGuests(base, 60, 60)).toEqual(base);
  });

  it("never scales a line below what is committed or spent", () => {
    const lines = [
      line({ id: "food", allocated: 40_000, committed: 30_000, perGuest: true }),
      line({ id: "favours", allocated: 10_000, spent: 9_000, perGuest: true }),
      line({ id: "comfort", allocated: 10_000, committed: 1_000, perGuest: true }),
    ];
    const half = scaleForGuests(lines, 60, 30);
    expect(half.map((l) => l.allocated)).toEqual([30_000, 9_000, 5_000]);
  });

  it("works when scaling down to one guest", () => {
    const one = scaleForGuests(base, 60, 1);
    expect(one.find((l) => l.id === "food")?.allocated).toBe(667);
    expect(one.find((l) => l.id === "venue")?.allocated).toBe(25_000);
  });

  it("rejects zero or negative counts", () => {
    expect(() => scaleForGuests(base, 0, 10)).toThrow(RangeError);
    expect(() => scaleForGuests(base, 10, -1)).toThrow(RangeError);
  });

  it("marks scaled user numbers as estimates but keeps quotes", () => {
    const lines = [
      line({ id: "u", allocated: 100, perGuest: true, source: "user" }),
      line({ id: "q", allocated: 100, perGuest: true, source: "quote" }),
    ];
    expect(scaleForGuests(lines, 1, 2).map((l) => l.source)).toEqual(["estimate", "quote"]);
  });
});

describe("summary and lineStatus", () => {
  it("reports over budget when committed exceeds allocated", () => {
    const lines = [
      line({ id: "a", allocated: 100, committed: 150 }),
      line({ id: "b", allocated: 50 }),
    ];
    const s = summary(lines, 150);
    expect(s.overBudget).toBe(true);
    expect(s.overLineIds).toEqual(["a"]);
    expect(lineStatus(lines[0] ?? line({ id: "x" }))).toEqual({
      used: 150,
      remaining: -50,
      over: true,
      overBy: 50,
      percentUsed: 150,
    });
  });

  it("reports totals and unallocated money for a healthy budget", () => {
    const lines = [
      line({ id: "a", allocated: 100, spent: 20 }),
      line({ id: "b", allocated: 50, committed: 10 }),
    ];
    expect(summary(lines, 200)).toEqual({
      total: 200,
      allocated: 150,
      committed: 10,
      spent: 20,
      remaining: 170,
      unallocated: 50,
      overBudget: false,
      overLineIds: [],
    });
  });

  it("handles empty budgets and zero allocations", () => {
    expect(summary([], 0).overBudget).toBe(false);
    expect(lineStatus(line({ id: "z" })).percentUsed).toBe(0);
    expect(lineStatus(line({ id: "z", spent: 5 })).percentUsed).toBe(100);
  });
});

describe("toggleLock and setSpent", () => {
  it("toggles the lock on one line", () => {
    const lines = toggleLock(event().budget, "venue");
    expect(lines.find((l) => l.id === "venue")?.locked).toBe(true);
    expect(toggleLock(lines, "venue").find((l) => l.id === "venue")?.locked).toBe(false);
  });
  it("records spending and rejects negatives", () => {
    const r = setSpent(event().budget, "venue", 500);
    expect(r.ok && r.value.find((l) => l.id === "venue")?.spent).toBe(500);
    expect(setSpent(event().budget, "venue", -1)).toEqual({ ok: false, error: "negative" });
  });
});
