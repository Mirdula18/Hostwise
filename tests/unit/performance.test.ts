import { applyOption } from "../../src/lib/change";
import { computeImpact } from "../../src/lib/impact";
import { topoSort } from "../../src/lib/taskGraph";
import { bucket, shiftWithDependents, todayTop3 } from "../../src/lib/timeline";
import { generateOptions } from "../../src/lib/tradeOffs";
import { event, line, task } from "./fixtures";
import type { Event } from "../../src/schemas/event";

/**
 * Upper bounds for the largest plans the app targets (100 guests, 15 categories,
 * 60 tasks). Budgets are generous so slow CI machines pass; a regression to
 * quadratic-or-worse behaviour would still fail them.
 */

const ITERATIONS = 50;
const MAX_MS_PER_CHANGE = 20;
const MAX_MS_PER_TIMELINE = 10;

function largeEvent(): Event {
  const budget = Array.from({ length: 15 }, (_, i) =>
    line({
      id: `l${i}`,
      category: `Category ${i}`,
      allocated: 20_000 + i * 1_000,
      perGuest: i % 2 === 0,
    }),
  );
  const tasks = Array.from({ length: 60 }, (_, i) =>
    task({
      id: `t${i}`,
      dueDate: `2026-12-${String((i % 28) + 1).padStart(2, "0")}`,
      dependsOn: i === 0 ? [] : [`t${i - 1}`, ...(i > 5 ? [`t${i - 5}`] : [])],
    }),
  );
  const base = event();
  return {
    ...base,
    budget,
    tasks,
    profile: {
      ...base.profile,
      guestCount: 100,
      totalBudget: budget.reduce((a, l) => a + l.allocated, 0),
    },
  };
}

function timePerRun(fn: () => void): number {
  fn();
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) fn();
  return (performance.now() - start) / ITERATIONS;
}

describe("performance", () => {
  const e = largeEvent();

  it(`computes impact, options and applies one in under ${MAX_MS_PER_CHANGE} ms`, () => {
    const ms = timePerRun(() => {
      const impact = computeImpact(e, { kind: "guests", newCount: 130 });
      const options = generateOptions(e, impact);
      const first = options[0];
      if (!first) throw new Error("expected options");
      expect(applyOption(e, impact, first).ok).toBe(true);
    });
    expect(ms).toBeLessThan(MAX_MS_PER_CHANGE);
  });

  it(`orders, buckets and delays 60 dependent tasks in under ${MAX_MS_PER_TIMELINE} ms`, () => {
    const ms = timePerRun(() => {
      topoSort(e.tasks);
      bucket(e.tasks, "2026-11-01");
      todayTop3(e.tasks, "2026-11-01", ["food"]);
      expect(shiftWithDependents(e.tasks, "t0", 3, "2027-01-31").ok).toBe(true);
    });
    expect(ms).toBeLessThan(MAX_MS_PER_TIMELINE);
  });
});
