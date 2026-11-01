import { applyOption } from "../../src/lib/change";
import { computeImpact } from "../../src/lib/impact";
import { generateOptions } from "../../src/lib/tradeOffs";
import { checkChange, diffEvents, mergeRanking } from "../../src/lib/ranking";
import { event } from "./fixtures";

const TODAY = "2026-11-01";

describe("mergeRanking", () => {
  const e = event();
  const impact = computeImpact(e, { kind: "guests", newCount: 80 });
  const options = generateOptions(e, impact);

  it("orders options by the AI ranking and attaches explanations", () => {
    const merged = mergeRanking(e, impact, options, {
      ranking: [
        { optionId: "raise-budget", why: "Keeps Food intact.", whatTheyGiveUp: "More money." },
        { optionId: "protect", why: "Protects Food.", whatTheyGiveUp: "Simpler décor." },
      ],
    });
    expect(merged.map((o) => [o.rank, o.id])).toEqual([
      [1, "raise-budget"],
      [2, "protect"],
      [3, "spread"],
      [4, "trim-guests"],
    ]);
    expect(merged[0]).toMatchObject({ why: "Keeps Food intact.", whatTheyGiveUp: "More money." });
    expect(merged[2]?.why).toBeUndefined();
  });

  it("ignores unknown or repeated ids and never changes the option numbers", () => {
    const merged = mergeRanking(e, impact, options, {
      ranking: [
        { optionId: "made-up", why: "x", whatTheyGiveUp: "x" },
        { optionId: "spread", why: "a", whatTheyGiveUp: "a" },
        { optionId: "spread", why: "b", whatTheyGiveUp: "b" },
      ],
    });
    expect(merged.map((o) => o.id)).toEqual(["spread", "protect", "trim-guests", "raise-budget"]);
    expect(merged[0]?.adjustments).toEqual(options.find((o) => o.id === "spread")?.adjustments);
  });

  it("keeps code order when ranking is unavailable", () => {
    expect(mergeRanking(e, impact, options, null).map((o) => o.id)).toEqual(
      options.map((o) => o.id),
    );
  });

  it("adds a valid custom option and drops an invalid one", () => {
    const valid = mergeRanking(e, impact, options, {
      ranking: [],
      custom: {
        label: "Cheaper venue",
        adjustments: [
          { category: "Venue", delta: -15_000 },
          { category: "Decor", delta: -4_999 },
        ],
        why: "Keeps Food and Comfort.",
      },
    });
    expect(valid.at(-1)).toMatchObject({ id: "custom", aiSuggested: true, rank: 5 });
    const invalid = mergeRanking(e, impact, options, {
      ranking: [],
      custom: { label: "Bad", adjustments: [{ category: "Venue", delta: -1 }], why: "x" },
    });
    expect(invalid.some((o) => o.id === "custom")).toBe(false);
  });
});

describe("checkChange", () => {
  const e = event();
  it("passes real changes through", () => {
    expect(checkChange(e, { kind: "guests", newCount: 80 }, TODAY).ok).toBe(true);
    expect(checkChange(e, { kind: "budget", newTotal: 1 }, TODAY).ok).toBe(true);
    expect(checkChange(e, { kind: "date", newDate: "2026-12-27" }, TODAY).ok).toBe(true);
    expect(checkChange(e, { kind: "delay", taskId: "a", days: 2 }, TODAY).ok).toBe(true);
  });

  it("explains no-op, past, unknown and unclear changes", () => {
    expect(checkChange(e, { kind: "guests", newCount: 60 }, TODAY)).toEqual({
      ok: false,
      error: "You already have 60 guests planned.",
    });
    expect(checkChange(e, { kind: "budget", newTotal: 100_000 }, TODAY).ok).toBe(false);
    expect(checkChange(e, { kind: "date", newDate: "2026-12-20" }, TODAY).ok).toBe(false);
    expect(checkChange(e, { kind: "date", newDate: "2026-10-01" }, TODAY)).toEqual({
      ok: false,
      error: "The new date needs to be after today.",
    });
    expect(checkChange(e, { kind: "delay", taskId: "zz", days: 2 }, TODAY).ok).toBe(false);
    expect(
      checkChange(e, { kind: "unclear", clarifyingQuestion: "More guests or fewer?" }, TODAY),
    ).toEqual({ ok: false, error: "More guests or fewer?" });
  });
});

describe("diffEvents", () => {
  it("lists money, guest and task differences", () => {
    const e = event();
    const impact = computeImpact(e, { kind: "guests", newCount: 80 });
    const [protect] = generateOptions(e, impact);
    const after = protect && applyOption(e, impact, protect);
    if (!after?.ok) throw new Error("expected ok");
    const diff = diffEvents(e, after.value);
    expect(diff.guests).toEqual({ before: 60, after: 80 });
    expect(diff.total).toEqual({ before: 100_000, after: 100_000 });
    expect(diff.lines.find((l) => l.category === "Catering")).toEqual({
      category: "Catering",
      before: 40_000,
      after: 53_333,
      delta: 13_333,
    });
    expect(diff.tasks).toEqual([]);

    const moved = applyOption(e, computeImpact(e, { kind: "delay", taskId: "b", days: 2 }), {
      id: "as-is",
      label: "x",
      adjustments: [],
      respectsTopPriority: true,
    });
    if (!moved.ok) throw new Error("expected ok");
    expect(diffEvents(e, moved.value).tasks.map((t) => [t.id, t.before, t.after])).toEqual([
      ["b", "2026-11-20", "2026-11-22"],
      ["c", "2026-12-10", "2026-12-12"],
    ]);
  });
});
