import { counterIds } from "../../src/lib/id";
import { planToEvent } from "../../src/lib/plan";
import { createSampleEvent, SAMPLE_PLAN, sampleProfile } from "../../src/lib/sample";
import { detectCycle } from "../../src/lib/timeline";
import { AIPlan } from "../../src/schemas/ai";
import { Event } from "../../src/schemas/event";
import { allocatedSum } from "./fixtures";

describe("planToEvent", () => {
  it("turns percents into exact amounts and offsets into dates", () => {
    const profile = sampleProfile("2026-11-01");
    const e = planToEvent(profile, SAMPLE_PLAN, "2026-11-01T00:00:00.000Z", counterIds());
    expect(allocatedSum(e.budget)).toBe(profile.totalBudget);
    expect(e.tasks.every((t) => t.dueDate <= profile.date)).toBe(true);
    expect(e.tasks.at(-1)?.dueDate).toBe(profile.date);
    expect(e.assumptions).toEqual(SAMPLE_PLAN.assumptions);
    expect(Event.safeParse(e).success).toBe(true);
  });

  it("renames duplicate categories and records dropped circular links", () => {
    const plan: AIPlan = {
      budget: [
        { category: "Food", percent: 50, perGuest: true },
        { category: "food", percent: 50, perGuest: true },
      ],
      tasks: [
        { key: "a", title: "A", category: "x", dueOffsetDays: 2, dependsOn: ["b"] },
        { key: "b", title: "B", category: "x", dueOffsetDays: 1, dependsOn: ["a"] },
      ],
      theme: "t".repeat(700),
      assumptions: [],
    };
    const e = planToEvent(sampleProfile("2026-11-01"), plan);
    expect(e.budget.map((l) => l.category)).toEqual(["Food", "food (2)"]);
    expect(e.theme).toHaveLength(600);
    expect(e.assumptions).toHaveLength(1);
    expect(detectCycle(e.tasks)).toBeNull();
  });
});

describe("sample event", () => {
  it("is a valid 60-guest vegetarian, wheelchair-accessible anniversary", () => {
    const e = createSampleEvent("2026-11-01");
    expect(Event.safeParse(e).success).toBe(true);
    expect(AIPlan.safeParse(SAMPLE_PLAN).success).toBe(true);
    expect(e.profile).toMatchObject({ occasion: "anniversary", guestCount: 60 });
    expect(e.profile.dietary).toMatch(/vegetarian/i);
    expect(e.profile.accessibility).toMatch(/wheelchair/i);
    expect(e.vendors).toHaveLength(2);
    expect(e.tasks.some((t) => t.vendorId === e.vendors[0]?.id)).toBe(true);
  });
});
