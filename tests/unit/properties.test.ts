import { rebalance } from "../../src/lib/budget";
import { applyOption } from "../../src/lib/change";
import { usedAmount } from "../../src/lib/budget";
import { computeImpact } from "../../src/lib/impact";
import { allocate, sum } from "../../src/lib/money";
import { detectCycle, topoSort, transitiveDependents } from "../../src/lib/taskGraph";
import { shiftWithDependents } from "../../src/lib/timeline";
import { generateOptions } from "../../src/lib/tradeOffs";
import { event, line, task } from "./fixtures";
import type { ActionableChange, BudgetLine, Event, Priority, Task } from "../../src/schemas/event";

/**
 * Property tests: each invariant is checked against hundreds of generated inputs.
 * A seeded generator (mulberry32) keeps every run reproducible; a failure message
 * includes the seed so the exact case can be replayed.
 */

const RUNS = 300;

function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => {
    const item = items[int(0, items.length - 1)];
    if (item === undefined) throw new Error("pick from an empty list");
    return item;
  };
  return { int, pick, chance: (p: number) => next() < p };
}

type Rng = ReturnType<typeof rng>;

const PRIORITIES: Priority[] = ["food", "venue", "decor", "entertainment", "guest_comfort"];

function randomLines(r: Rng): BudgetLine[] {
  const count = r.int(2, 10);
  return Array.from({ length: count }, (_, i) =>
    line({
      id: `l${i}`,
      category: `Cat ${i}`,
      allocated: r.int(0, 50_000),
      committed: r.chance(0.2) ? r.int(0, 5_000) : 0,
      perGuest: r.chance(0.4),
      locked: r.chance(0.15),
      ...(r.chance(0.6) ? { priorityTag: r.pick(PRIORITIES) } : {}),
    }),
  ).map((l) => ({ ...l, allocated: Math.max(l.allocated, usedAmount(l)) }));
}

function randomEvent(r: Rng): Event {
  const budget = randomLines(r);
  const base = event();
  return {
    ...base,
    budget,
    profile: {
      ...base.profile,
      guestCount: r.int(20, 100),
      totalBudget: sum(budget.map((l) => l.allocated)),
      priorities: [r.pick(PRIORITIES), r.pick(PRIORITIES)].filter((p, i, a) => a.indexOf(p) === i),
    },
  };
}

function randomChange(r: Rng, e: Event): ActionableChange {
  const { guestCount, totalBudget } = e.profile;
  return r.chance(0.5)
    ? { kind: "guests", newCount: Math.max(1, guestCount + r.int(-15, 30)) }
    : {
        kind: "budget",
        newTotal: Math.max(1, totalBudget + r.int(-Math.floor(totalBudget / 2), 40_000)),
      };
}

/** A random acyclic task graph: each task may depend only on earlier tasks. */
function randomDag(r: Rng): Task[] {
  const count = r.int(1, 25);
  return Array.from({ length: count }, (_, i) =>
    task({
      id: `t${i}`,
      dueDate: `2026-12-${String(r.int(1, 28)).padStart(2, "0")}`,
      dependsOn: Array.from({ length: i }, (_, j) => `t${j}`).filter(() => r.chance(0.2)),
    }),
  );
}

describe("money invariants", () => {
  it("allocate always returns non-negative integers that sum exactly to the total", () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const r = rng(seed);
      const total = r.int(0, 10_000_000);
      const weights = Array.from({ length: r.int(1, 15) }, () => r.int(-10, 1_000));
      const parts = allocate(total, weights);
      expect(sum(parts), `seed ${seed}`).toBe(total);
      expect(
        parts.every((p) => Number.isInteger(p) && p >= 0),
        `seed ${seed}`,
      ).toBe(true);
      expect(parts).toHaveLength(weights.length);
    }
  });

  it("rebalance keeps the total, sets the edited line and never moves a locked line", () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const r = rng(seed);
      const lines = randomLines(r);
      const target = r.pick(lines);
      const amount = r.int(0, 80_000);
      const result = rebalance(lines, target.id, amount, ["food", "venue"]);
      if (!result.ok) continue;
      const next = result.value;
      expect(sum(next.map((l) => l.allocated)), `seed ${seed}`).toBe(
        sum(lines.map((l) => l.allocated)),
      );
      expect(next.find((l) => l.id === target.id)?.allocated, `seed ${seed}`).toBe(amount);
      for (const before of lines.filter((l) => l.locked && l.id !== target.id)) {
        expect(next.find((l) => l.id === before.id)?.allocated, `seed ${seed}`).toBe(
          before.allocated,
        );
      }
    }
  });
});

describe("change engine invariants", () => {
  it("every generated option applies, balances exactly, and respects locks and commitments", () => {
    let checked = 0;
    for (let seed = 1; seed <= RUNS; seed++) {
      const r = rng(seed);
      const e = randomEvent(r);
      const impact = computeImpact(e, randomChange(r, e));
      for (const option of generateOptions(e, impact)) {
        const applied = applyOption(e, impact, option, "2026-11-01T00:00:00Z");
        expect(applied.ok, `seed ${seed} option ${option.id}`).toBe(true);
        if (!applied.ok) continue;
        const after = applied.value;
        expect(sum(after.budget.map((l) => l.allocated)), `seed ${seed}`).toBe(
          after.profile.totalBudget,
        );
        expect(
          after.budget.every((l) => l.allocated >= usedAmount(l)),
          `seed ${seed}`,
        ).toBe(true);
        const touched = new Set(
          option.adjustments.filter((a) => a.delta !== 0).map((a) => a.category),
        );
        for (const locked of e.budget.filter((l) => l.locked)) {
          expect(touched.has(locked.category), `seed ${seed} moved locked ${locked.category}`).toBe(
            false,
          );
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(RUNS);
  });

  it("never offers an empty option list for an actionable change", () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const r = rng(seed);
      const e = randomEvent(r);
      const impact = computeImpact(e, randomChange(r, e));
      expect(generateOptions(e, impact).length, `seed ${seed}`).toBeGreaterThan(0);
    }
  });
});

describe("task graph invariants", () => {
  it("topoSort puts every dependency before its dependents in random acyclic graphs", () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const tasks = randomDag(rng(seed));
      expect(detectCycle(tasks), `seed ${seed}`).toBeNull();
      const order = new Map(topoSort(tasks).map((t, i) => [t.id, i]));
      expect(order.size).toBe(tasks.length);
      for (const t of tasks) {
        for (const d of t.dependsOn) {
          expect(order.get(d) ?? Infinity, `seed ${seed}`).toBeLessThan(order.get(t.id) ?? -1);
        }
      }
    }
  });

  it("detects the cycle created by any back edge", () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const r = rng(seed);
      const tasks = randomDag(r);
      const withDeps = tasks.filter((t) => t.dependsOn.length > 0);
      if (withDeps.length === 0) continue;
      const child = r.pick(withDeps);
      const parentId = r.pick(child.dependsOn);
      const looped = tasks.map((t) =>
        t.id === parentId ? { ...t, dependsOn: [...t.dependsOn, child.id] } : t,
      );
      expect(detectCycle(looped), `seed ${seed}`).not.toBeNull();
    }
  });

  it("a delay moves exactly the task and its transitive dependents by the same days", () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const r = rng(seed);
      const tasks = randomDag(r);
      const target = r.pick(tasks);
      const days = r.int(1, 30);
      const shifted = shiftWithDependents(tasks, target.id, days, "2027-06-30");
      expect(shifted.ok, `seed ${seed}`).toBe(true);
      if (!shifted.ok) continue;
      const moved = new Set([target.id, ...transitiveDependents(tasks, target.id)]);
      expect(new Set(shifted.value.affectedIds), `seed ${seed}`).toEqual(moved);
      for (const [i, before] of tasks.entries()) {
        const after = shifted.value.tasks[i];
        const delta = after
          ? (Date.parse(after.dueDate) - Date.parse(before.dueDate)) / 86_400_000
          : NaN;
        expect(Math.round(delta), `seed ${seed} ${before.id}`).toBe(
          moved.has(before.id) ? days : 0,
        );
      }
    }
  });
});
