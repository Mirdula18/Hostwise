import { parseChangeInput, rankOptionsInput } from "../../src/lib/ai/inputs";
import { computeImpact } from "../../src/lib/impact";
import { generateOptions } from "../../src/lib/tradeOffs";
import { LIMITS } from "../../src/lib/constants";
import { counterIds } from "../../src/lib/id";
import { createSampleEvent } from "../../src/lib/sample";
import { TaskInputs } from "../../functions/api/_lib/schemas";
import type { Event } from "../../src/schemas/event";

const sample = (): Event => createSampleEvent("2026-11-01", "2026-11-01T00:00:00Z", counterIds());

describe("parseChangeInput", () => {
  it("sends only open tasks and passes the proxy's strict schema", () => {
    const event = sample();
    const first = event.tasks[0];
    if (!first) throw new Error("sample has tasks");
    const done = {
      ...event,
      tasks: event.tasks.map((t) => (t.id === first.id ? { ...t, status: "done" as const } : t)),
    };
    const input = parseChangeInput(done, "add 20 guests", "2026-11-01");
    expect(input.tasks.map((t) => t.id)).not.toContain(first.id);
    expect(input).toMatchObject({ text: "add 20 guests", guestCount: 60, currency: "INR" });
    expect(TaskInputs.parse_change.safeParse(input).success).toBe(true);
  });

  it("caps the task list at the proxy limit", () => {
    const event = sample();
    const first = event.tasks[0];
    if (!first) throw new Error("sample has tasks");
    const many = Array.from({ length: LIMITS.CHANGE_TASKS_MAX + 5 }, (_, i) => ({
      ...first,
      id: `t${i}`,
    }));
    expect(parseChangeInput({ ...event, tasks: many }, "x", "2026-11-01").tasks).toHaveLength(
      LIMITS.CHANGE_TASKS_MAX,
    );
  });

  it("sends an empty task list when every task is done", () => {
    const event = sample();
    const allDone = {
      ...event,
      tasks: event.tasks.map((t) => ({ ...t, status: "done" as const })),
    };
    expect(parseChangeInput(allDone, "x", "2026-11-01").tasks).toEqual([]);
  });
});

describe("rankOptionsInput", () => {
  it("carries priorities, options and lock state, and passes the proxy's strict schema", () => {
    const event = sample();
    const impact = computeImpact(event, { kind: "guests", newCount: 80 });
    const options = generateOptions(event, impact);
    const input = rankOptionsInput(event, impact, options);
    expect(input.profile).toEqual({
      priorities: event.profile.priorities,
      guestCount: 60,
      occasion: "anniversary",
    });
    expect(input.categories).toHaveLength(event.budget.length);
    expect(input.categories.every((c) => !c.locked)).toBe(true);
    expect(TaskInputs.rank_options.safeParse(input).success).toBe(true);
  });
});
