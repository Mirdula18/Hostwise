import { applyOption, validateCustomOption } from "../../src/lib/change";
import { baseLines, computeImpact, describeChange } from "../../src/lib/impact";
import { generateOptions } from "../../src/lib/tradeOffs";
import type { ActionableChange, Event, TradeOffOption } from "../../src/schemas/event";
import { allocatedSum, event } from "./fixtures";
import { must } from "../must";

const NOW = "2026-11-01T10:00:00.000Z";

function applyAll(e: Event, request: ActionableChange) {
  const impact = computeImpact(e, request);
  const options = generateOptions(e, impact);
  return { impact, options, results: options.map((o) => applyOption(e, impact, o, NOW)) };
}

function expectResolves(e: Event, request: ActionableChange) {
  const { results } = applyAll(e, request);
  expect(results.length).toBeGreaterThan(0);
  for (const r of results) {
    expect(r.ok).toBe(true);
    if (r.ok) expect(allocatedSum(r.value.budget)).toBe(r.value.profile.totalBudget);
  }
}

describe("computeImpact", () => {
  it("budget cut of 20% gives a negative gap", () => {
    const impact = computeImpact(event(), { kind: "budget", newTotal: 80_000 });
    expect(impact.gap).toBe(-20_000);
    expect(impact.before).toEqual({ total: 100_000, allocatedSum: 100_000 });
    expect(impact.after).toEqual({ total: 80_000, requiredSum: 100_000 });
    expect(impact.affectedCategories).toContain("Decor");
  });

  it("adding 20 guests raises the per-guest required sum and reports the shortfall", () => {
    const impact = computeImpact(event(), { kind: "guests", newCount: 80 });
    expect(impact.after.requiredSum).toBe(119_999);
    expect(impact.gap).toBe(100_000 - 119_999);
    expect(impact.affectedCategories).toEqual(["Catering", "Comfort", "Favours"]);
    expect(impact.affectedTaskIds).toEqual(["b", "c"]);
  });

  it("budget increase gives a positive gap", () => {
    expect(computeImpact(event(), { kind: "budget", newTotal: 120_000 }).gap).toBe(20_000);
  });

  it("date and delay changes do not touch money but list affected tasks", () => {
    expect(computeImpact(event(), { kind: "date", newDate: "2026-12-27" })).toMatchObject({
      gap: 0,
      affectedTaskIds: ["a", "b", "c", "d"],
    });
    expect(computeImpact(event(), { kind: "delay", taskId: "a", days: 3 }).affectedTaskIds).toEqual(
      ["a", "b", "c"],
    );
    expect(
      computeImpact(event(), { kind: "delay", taskId: "zz", days: 3 }).affectedTaskIds,
    ).toEqual([]);
  });

  it("baseLines only scales for guest changes", () => {
    expect(baseLines(event(), { kind: "budget", newTotal: 1 })).toEqual(event().budget);
  });
});

describe("generateOptions", () => {
  it("budget cut options protect the #1 priority and resolve the gap exactly", () => {
    const e = event();
    const { options } = applyAll(e, { kind: "budget", newTotal: 80_000 });
    const protect = options.find((o) => o.id === "protect");
    expect(protect?.respectsTopPriority).toBe(true);
    expect(protect?.adjustments).toEqual([
      { category: "Decor", delta: -15_000 },
      { category: "Favours", delta: -5_000 },
    ]);
    expect(options.map((o) => o.id)).toEqual(["protect", "spread", "raise-budget"]);
    for (const o of options.filter((x) => x.id !== "raise-budget")) {
      expect(o.adjustments.some((a) => a.category === "Catering")).toBe(false);
      expect(o.adjustments.reduce((s, a) => s + a.delta, 0)).toBe(-20_000);
    }
    expectResolves(e, { kind: "budget", newTotal: 80_000 });
  });

  it("add 20 guests offers trims, fewer guests and a budget raise that all balance", () => {
    const e = event();
    const { options, results } = applyAll(e, { kind: "guests", newCount: 80 });
    expect(options.map((o) => o.id)).toEqual(["protect", "spread", "trim-guests", "raise-budget"]);
    expect(options.find((o) => o.id === "raise-budget")?.budgetChange).toBe(19_999);
    const half = results[2];
    expect(half?.ok && half.value.profile.guestCount).toBe(70);
    expect(options[2]).toMatchObject({
      label: "Invite 10 more guests instead of 20; trim Decor",
      guestCountChange: -10,
      respectsTopPriority: true,
    });
    expectResolves(e, { kind: "guests", newCount: 80 });
  });

  it("keeps the guest list when no lower priority can be trimmed", () => {
    const e = event({
      budget: event().budget.map((l) => ({ ...l, locked: l.id !== "food" })),
    });
    const impact = computeImpact(e, { kind: "guests", newCount: 80 });
    const keep = generateOptions(e, impact).find((o) => o.id === "trim-guests");
    expect(keep).toMatchObject({ label: "Keep the guest list at 60", adjustments: [] });
    const r = keep && applyOption(e, impact, keep);
    expect(r && r.ok && r.value.profile.guestCount).toBe(60);
  });

  it("budget increase distributes the surplus with most going to the top priority", () => {
    const e = event();
    const { options } = applyAll(e, { kind: "budget", newTotal: 120_000 });
    const boost = options[0];
    expect(boost?.id).toBe("boost-priorities");
    const food = boost?.adjustments.find((a) => a.category === "Catering")?.delta ?? 0;
    expect(Math.max(...(boost?.adjustments.map((a) => a.delta) ?? []))).toBe(food);
    expect(options.map((o) => o.id)).toContain("spread-extra");
    expectResolves(e, { kind: "budget", newTotal: 120_000 });
  });

  it("fewer guests frees money and can lower the budget", () => {
    const e = event();
    const { options } = applyAll(e, { kind: "guests", newCount: 40 });
    expect(options.map((o) => o.id)).toContain("lower-budget");
    expectResolves(e, { kind: "guests", newCount: 40 });
  });

  it("never adjusts locked lines", () => {
    const e = event({
      budget: event().budget.map((l) => (l.id === "decor" ? { ...l, locked: true } : l)),
    });
    for (const request of [
      { kind: "budget", newTotal: 80_000 },
      { kind: "budget", newTotal: 130_000 },
      { kind: "guests", newCount: 80 },
    ] satisfies ActionableChange[]) {
      const { options } = applyAll(e, request);
      for (const o of options) {
        expect(o.adjustments.some((a) => a.category === "Decor")).toBe(false);
      }
      expectResolves(e, request);
    }
  });

  it("marks respectsTopPriority false when only the top priority can absorb the cut", () => {
    const e = event({
      budget: event().budget.map((l) => (l.id === "food" ? l : { ...l, locked: true })),
    });
    const { options } = applyAll(e, { kind: "budget", newTotal: 90_000 });
    expect(options[0]).toMatchObject({ id: "trim-all", respectsTopPriority: false });
    expect(options[0]?.label).toMatch(/including Food/);
    expectResolves(e, { kind: "budget", newTotal: 90_000 });
  });

  it("only offers raising the budget when nothing can be trimmed", () => {
    const e = event({ budget: event().budget.map((l) => ({ ...l, locked: true })) });
    const { options } = applyAll(e, { kind: "budget", newTotal: 90_000 });
    expect(options.map((o) => o.id)).toEqual(["raise-budget"]);
  });

  it("returns a single as-is option when money is unaffected", () => {
    const { options } = applyAll(event(), { kind: "date", newDate: "2026-12-27" });
    expect(options).toEqual([
      { id: "as-is", label: "Apply the change", adjustments: [], respectsTopPriority: true },
    ]);
  });

  it("returns nothing for an unclear request", () => {
    const impact = { ...computeImpact(event(), { kind: "budget", newTotal: 1 }) };
    expect(
      generateOptions(event(), {
        ...impact,
        request: { kind: "unclear", clarifyingQuestion: "?" },
      }),
    ).toEqual([]);
  });
});

describe("applyOption", () => {
  it("returns a new event without mutating the input and appends to the changeLog", () => {
    const e = event();
    const snapshot = JSON.stringify(e);
    const impact = computeImpact(e, { kind: "guests", newCount: 80 });
    const [first] = generateOptions(e, impact);
    if (!first) throw new Error("expected an option");
    const r = applyOption(e, impact, first, NOW);
    expect(JSON.stringify(e)).toBe(snapshot);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).not.toBe(e);
    expect(r.value.profile.guestCount).toBe(80);
    expect(r.value.changeLog).toEqual([{ at: NOW, summary: `Guests 60 → 80: ${first.label}` }]);
    expect(r.value.updatedAt).toBe(NOW);
  });

  it("date change moves tasks by the difference between the new and old dates", () => {
    const e = event();
    const impact = computeImpact(e, { kind: "date", newDate: "2026-12-27" });
    const r = applyOption(e, impact, must(generateOptions(e, impact)[0]), NOW);
    expect(r.ok && r.value.profile.date).toBe("2026-12-27");
    expect(r.ok && r.value.tasks.map((t) => t.dueDate)).toEqual([
      "2026-11-17",
      "2026-11-27",
      "2026-12-17",
      "2026-12-22",
    ]);
  });

  it("delay change shifts the task and its dependents", () => {
    const e = event();
    const impact = computeImpact(e, { kind: "delay", taskId: "b", days: 5 });
    const r = applyOption(e, impact, must(generateOptions(e, impact)[0]), NOW);
    expect(r.ok && r.value.tasks.map((t) => t.dueDate)).toEqual([
      "2026-11-10",
      "2026-11-25",
      "2026-12-15",
      "2026-12-15",
    ]);
    const bad = computeImpact(e, { kind: "delay", taskId: "zz", days: 5 });
    expect(
      applyOption(e, bad, { id: "x", label: "x", adjustments: [], respectsTopPriority: true }),
    ).toEqual({
      ok: false,
      error: "unknown_task",
    });
  });

  it("rejects options that touch locked or unknown categories, or do not balance", () => {
    const e = event({
      budget: event().budget.map((l) => (l.id === "decor" ? { ...l, locked: true } : l)),
    });
    const impact = computeImpact(e, { kind: "budget", newTotal: 90_000 });
    const opt = (adjustments: TradeOffOption["adjustments"]): TradeOffOption => ({
      id: "t",
      label: "t",
      adjustments,
      respectsTopPriority: true,
    });
    expect(applyOption(e, impact, opt([{ category: "Decor", delta: -10_000 }])).ok).toBe(false);
    expect(applyOption(e, impact, opt([{ category: "Nope", delta: -10_000 }]))).toEqual({
      ok: false,
      error: "unknown_category",
    });
    expect(applyOption(e, impact, opt([{ category: "Venue", delta: -5_000 }]))).toEqual({
      ok: false,
      error: "unbalanced",
    });
    expect(
      applyOption(
        e,
        impact,
        opt([
          { category: "Venue", delta: -26_000 },
          { category: "Catering", delta: 16_000 },
        ]),
      ),
    ).toEqual({
      ok: false,
      error: "below_committed",
    });
    const unclear = { ...impact, request: { kind: "unclear" as const, clarifyingQuestion: "?" } };
    expect(applyOption(e, unclear, opt([])).ok).toBe(false);
  });
});

describe("validateCustomOption", () => {
  const e = event();
  const impact = computeImpact(e, { kind: "budget", newTotal: 90_000 });

  it("accepts a balanced custom option and works out whether it respects the top priority", () => {
    const ok = validateCustomOption(e, impact, {
      label: "Smaller venue",
      adjustments: [{ category: "Venue", delta: -10_000 }],
    });
    expect(ok).toMatchObject({ id: "custom", label: "Smaller venue", respectsTopPriority: true });
    const cutsFood = validateCustomOption(e, impact, {
      label: " ",
      adjustments: [{ category: "Catering", delta: -10_000 }],
    });
    expect(cutsFood).toMatchObject({ label: "Custom mix", respectsTopPriority: false });
  });

  it("discards options that do not balance, are empty or touch locked lines", () => {
    expect(validateCustomOption(e, impact, { label: "x", adjustments: [] })).toBeNull();
    expect(
      validateCustomOption(e, impact, {
        label: "x",
        adjustments: [{ category: "Venue", delta: -1 }],
      }),
    ).toBeNull();
    const locked = event({ budget: e.budget.map((l) => ({ ...l, locked: l.id === "venue" })) });
    expect(
      validateCustomOption(locked, computeImpact(locked, { kind: "budget", newTotal: 90_000 }), {
        label: "x",
        adjustments: [{ category: "Venue", delta: -10_000 }],
      }),
    ).toBeNull();
  });
});

describe("describeChange", () => {
  it("describes each kind of change in plain words", () => {
    const e = event();
    expect(describeChange(e, { kind: "budget", newTotal: 80_000 })).toBe("Budget ₹1,000 → ₹800");
    expect(describeChange(e, { kind: "date", newDate: "2026-12-27" })).toBe(
      "Event date 2026-12-20 → 2026-12-27",
    );
    expect(describeChange(e, { kind: "delay", taskId: "a", days: 1 })).toBe(
      '"Book venue" delayed by 1 day',
    );
    expect(describeChange(e, { kind: "delay", taskId: "zz", days: 2 })).toBe(
      '"A task" delayed by 2 days',
    );
  });
});
