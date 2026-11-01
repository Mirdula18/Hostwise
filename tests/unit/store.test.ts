import { computeImpact, generateOptions } from "../../src/lib/change";
import { createSampleEvent } from "../../src/lib/sample";
import { migrate, STORE_KEY } from "../../src/store/migrations";
import { UNDO_LIMIT, useEventStore } from "../../src/store/useEventStore";
import { event } from "./fixtures";
import { z } from "zod";
import { parseJson } from "../../src/lib/json";

/** The persisted store envelope written by zustand/persist. */
const Saved = z.object({ version: z.number(), state: z.record(z.string(), z.unknown()) });

const reset = () => useEventStore.setState({ events: {}, activeId: null, history: {} });

describe("useEventStore", () => {
  beforeEach(reset);

  it("creates an event and makes it active", () => {
    const id = useEventStore.getState().createEvent(event());
    expect(useEventStore.getState().activeId).toBe(id);
    expect(useEventStore.getState().events[id]?.profile.title).toBe("Test");
  });

  it("applyChange updates budget and guests atomically and undo restores exactly", () => {
    const e = event();
    const { createEvent, applyChange, undo } = useEventStore.getState();
    createEvent(e);
    const before = structuredClone(useEventStore.getState().events.e1);
    const impact = computeImpact(e, { kind: "guests", newCount: 80 });
    const [option] = generateOptions(e, impact);
    if (!option) throw new Error("expected an option");

    expect(applyChange("e1", impact, option)).toEqual({ ok: true, value: undefined });
    const after = useEventStore.getState().events.e1;
    expect(after?.profile.guestCount).toBe(80);
    expect(after?.changeLog).toHaveLength(1);

    expect(useEventStore.getState().undo("e1")).toBe(true);
    expect(useEventStore.getState().events.e1).toEqual(before);
    expect(undo("e1")).toBe(false);
  });

  it("rejects an invalid option without touching state or history", () => {
    useEventStore.getState().createEvent(event());
    const e = useEventStore.getState().events.e1;
    if (!e) throw new Error("missing");
    const impact = computeImpact(e, { kind: "budget", newTotal: 90_000 });
    const r = useEventStore.getState().applyChange("e1", impact, {
      id: "x",
      label: "x",
      adjustments: [],
      respectsTopPriority: true,
    });
    expect(r.ok).toBe(false);
    expect(useEventStore.getState().events.e1).toBe(e);
    expect(useEventStore.getState().history.e1).toBeUndefined();
  });

  it("caps the undo stack", () => {
    useEventStore.getState().createEvent(event());
    for (let i = 0; i < UNDO_LIMIT + 5; i++) {
      expect(useEventStore.getState().delayTask("e1", "d", 1).ok).toBe(true);
    }
    expect(useEventStore.getState().history.e1).toHaveLength(UNDO_LIMIT);
  });

  it("delayTask shifts dependents and can be undone", () => {
    useEventStore.getState().createEvent(event());
    useEventStore.getState().delayTask("e1", "a", 5);
    const tasks = useEventStore.getState().events.e1?.tasks ?? [];
    expect(tasks.map((t) => t.dueDate)).toEqual([
      "2026-11-15",
      "2026-11-25",
      "2026-12-15",
      "2026-12-15",
    ]);
    useEventStore.getState().undo("e1");
    expect(useEventStore.getState().events.e1?.tasks[0]?.dueDate).toBe("2026-11-10");
    expect(useEventStore.getState().delayTask("nope", "a", 1).ok).toBe(false);
  });

  it("edits budget lines by rebalancing or by changing the total", () => {
    const s = useEventStore.getState();
    s.createEvent(event());
    expect(s.updateBudgetLine("e1", "food", 50_000, "rebalance").ok).toBe(true);
    expect(useEventStore.getState().events.e1?.profile.totalBudget).toBe(100_000);
    // Decor gave 10k to catering above (15k -> 5k); setting it to 20k adds 15k to the total.
    expect(s.updateBudgetLine("e1", "decor", 20_000, "changeTotal").ok).toBe(true);
    expect(useEventStore.getState().events.e1?.profile.totalBudget).toBe(115_000);
    expect(s.updateBudgetLine("e1", "decor", -1, "rebalance").ok).toBe(false);
    s.lockLine("e1", "venue");
    expect(useEventStore.getState().events.e1?.budget.find((l) => l.id === "venue")?.locked).toBe(
      true,
    );
    expect(s.setLineSpent("e1", "venue", 100).ok).toBe(true);
    expect(s.setLineSpent("e1", "venue", -1).ok).toBe(false);
  });

  it("adds, edits and deletes tasks through the lib rules", () => {
    const s = useEventStore.getState();
    s.createEvent(event());
    expect(
      s.addTask("e1", { title: "New", category: "x", dueDate: "2026-12-01", dependsOn: ["a"] }).ok,
    ).toBe(true);
    expect(s.updateTask("e1", "a", { dependsOn: ["c"] }).ok).toBe(false);
    expect(s.updateTask("e1", "a", { status: "done" }).ok).toBe(true);
    s.deleteTask("e1", "a");
    expect(useEventStore.getState().events.e1?.tasks.some((t) => t.id === "a")).toBe(false);
  });

  it("manages vendors and quotes and keeps committed amounts in sync", () => {
    const s = useEventStore.getState();
    s.createEvent(event());
    s.addVendor("e1", { name: "Bloom", category: "Decor", status: "considering" });
    const vendor = useEventStore.getState().events.e1?.vendors[0];
    if (!vendor) throw new Error("missing vendor");
    expect(s.addQuote("e1", vendor.id, { amount: 9_000, includes: "Flowers" }).ok).toBe(true);
    const quote = useEventStore.getState().events.e1?.vendors[0]?.quotes[0];
    if (!quote) throw new Error("missing quote");
    expect(s.acceptQuote("e1", vendor.id, quote.id).ok).toBe(true);
    const decor = () => useEventStore.getState().events.e1?.budget.find((l) => l.id === "decor");
    expect(decor()).toMatchObject({ committed: 9_000, source: "quote" });
    s.unacceptQuote("e1", vendor.id, quote.id);
    expect(decor()?.committed).toBe(0);
    s.updateVendor("e1", vendor.id, { notes: "Call back" });
    expect(useEventStore.getState().events.e1?.vendors[0]?.notes).toBe("Call back");
    s.removeVendor("e1", vendor.id);
    expect(useEventStore.getState().events.e1?.vendors).toEqual([]);
  });

  it("deletes events and clears the active id", () => {
    const s = useEventStore.getState();
    s.createEvent(event());
    s.deleteEvent("e1");
    expect(useEventStore.getState()).toMatchObject({ events: {}, activeId: null });
    s.setActive("x");
    expect(useEventStore.getState().activeId).toBe("x");
  });

  it("imports valid files and leaves state unchanged on a malformed file", () => {
    const s = useEventStore.getState();
    s.createEvent(event());
    const before = useEventStore.getState().events;
    expect(s.importEvents("{broken").ok).toBe(false);
    expect(useEventStore.getState().events).toBe(before);
    const sample = createSampleEvent("2026-11-01");
    expect(s.importEvents(JSON.stringify({ version: 1, events: [sample] }))).toEqual({
      ok: true,
      value: 1,
    });
    expect(Object.keys(useEventStore.getState().events)).toHaveLength(2);
  });

  it("persists events and activeId (not history) under hostwise:v1", () => {
    useEventStore.getState().createEvent(event());
    useEventStore.getState().delayTask("e1", "a", 1);
    const saved = Saved.parse(parseJson(localStorage.getItem(STORE_KEY) ?? "{}"));
    expect(saved.version).toBe(1);
    expect(Object.keys(saved.state)).toEqual(["events", "activeId"]);
    expect(saved.state).toMatchObject({ events: { e1: { profile: { title: "Test" } } } });
  });
});

describe("migrate", () => {
  it("keeps valid events and drops corrupt ones", () => {
    const good = event();
    const state = migrate({ events: { e1: good, bad: { id: "bad" } }, activeId: "bad" }, 1);
    expect(state).toEqual({ events: { e1: good }, activeId: null });
  });

  it("starts fresh for unknown versions or garbage", () => {
    expect(migrate({ events: {} }, 99)).toEqual({ events: {}, activeId: null });
    expect(migrate(null, 1)).toEqual({ events: {}, activeId: null });
    expect(migrate({ events: "nope", activeId: 3 }, 1)).toEqual({ events: {}, activeId: null });
  });
});
