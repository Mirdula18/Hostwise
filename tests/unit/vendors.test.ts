import { counterIds } from "../../src/lib/id";
import {
  acceptQuote,
  addQuote,
  addVendor,
  compareQuotes,
  removeVendor,
  syncCommitted,
  unacceptQuote,
  updateVendor,
} from "../../src/lib/vendors";
import type { Vendor } from "../../src/schemas/event";
import { event, line } from "./fixtures";

const NOW = "2026-11-01T10:00:00.000Z";

function vendors(): Vendor[] {
  return [
    {
      id: "v1",
      name: "Annapurna",
      category: "Catering",
      status: "quoted",
      quotes: [
        { id: "q1", amount: 45_000, includes: "Buffet", accepted: false },
        { id: "q2", amount: 38_000, includes: "Smaller buffet", accepted: false },
      ],
    },
    {
      id: "v2",
      name: "Spice Route",
      category: "Catering",
      status: "quoted",
      quotes: [{ id: "q3", amount: 39_000, includes: "Plated", accepted: false }],
    },
    { id: "v3", name: "Bloom", category: "Decor", status: "considering", quotes: [] },
  ];
}

describe("compareQuotes", () => {
  it("sorts by amount and flags quotes over the allocation", () => {
    const rows = compareQuotes(vendors(), "Catering", 40_000);
    expect(rows.map((r) => r.quote.id)).toEqual(["q2", "q3", "q1"]);
    expect(rows.map((r) => r.over)).toEqual([false, false, true]);
    expect(rows[2]?.overBy).toBe(5_000);
    expect(rows[0]?.vendorName).toBe("Annapurna");
  });

  it("returns nothing for a category with no quotes", () => {
    expect(compareQuotes(vendors(), "Decor", 10)).toEqual([]);
    expect(compareQuotes([], "Catering", 10)).toEqual([]);
  });
});

describe("acceptQuote", () => {
  it("sets committed, marks the line as a quote and unaccepts other quotes from that vendor", () => {
    const e = { ...event(), vendors: vendors() };
    const first = acceptQuote(e, "v1", "q1", NOW);
    if (!first.ok) throw new Error("expected ok");
    const second = acceptQuote(first.value, "v1", "q2", NOW);
    if (!second.ok) throw new Error("expected ok");
    const v1 = second.value.vendors.find((v) => v.id === "v1");
    expect(v1?.quotes.map((q) => q.accepted)).toEqual([false, true]);
    expect(v1?.status).toBe("booked");
    const catering = second.value.budget.find((l) => l.category === "Catering");
    expect(catering).toMatchObject({ committed: 38_000, source: "quote" });
    expect(second.value.updatedAt).toBe(NOW);
  });

  it("adds up accepted quotes from different vendors in one category", () => {
    const e = { ...event(), vendors: vendors() };
    const a = acceptQuote(e, "v1", "q2");
    const b = a.ok ? acceptQuote(a.value, "v2", "q3") : a;
    expect(b.ok && b.value.budget.find((l) => l.category === "Catering")?.committed).toBe(77_000);
  });

  it("reports unknown vendors, quotes and missing budget categories", () => {
    const e = { ...event(), vendors: vendors() };
    expect(acceptQuote(e, "zz", "q1")).toEqual({ ok: false, error: "vendor_not_found" });
    expect(acceptQuote(e, "v1", "zz")).toEqual({ ok: false, error: "quote_not_found" });
    const orphan = {
      ...e,
      vendors: [{ ...vendors()[0], category: "Fireworks" } as Vendor],
    };
    expect(acceptQuote(orphan, "v1", "q1")).toEqual({ ok: false, error: "no_budget_category" });
  });

  it("unaccepting releases the commitment and reverts the source to estimate", () => {
    const e = { ...event(), vendors: vendors() };
    const accepted = acceptQuote(e, "v1", "q1");
    if (!accepted.ok) throw new Error("expected ok");
    const undone = unacceptQuote(accepted.value, "v1", "q1");
    expect(undone.budget.find((l) => l.category === "Catering")).toMatchObject({
      committed: 0,
      source: "estimate",
    });
    expect(undone.vendors[0]?.status).toBe("quoted");
  });
});

describe("syncCommitted", () => {
  it("keeps the same object when nothing changes and preserves user sources", () => {
    const lines = [line({ id: "a", category: "Venue", source: "user" })];
    expect(syncCommitted(lines, [])[0]).toBe(lines[0]);
  });
});

describe("vendor editing", () => {
  it("adds, updates and removes vendors", () => {
    const list = addVendor(
      [],
      { name: "Bloom", category: "Decor", status: "considering" },
      counterIds(),
    );
    expect(list[0]).toMatchObject({ id: "vendor_1", quotes: [] });
    expect(updateVendor(list, "vendor_1", { status: "contacted" })[0]?.status).toBe("contacted");

    const e = {
      ...event(),
      vendors: vendors(),
      tasks: event().tasks.map((t) => (t.id === "b" ? { ...t, vendorId: "v1" } : t)),
    };
    const accepted = acceptQuote(e, "v1", "q1");
    if (!accepted.ok) throw new Error("expected ok");
    const removed = removeVendor(accepted.value, "v1");
    expect(removed.vendors.map((v) => v.id)).toEqual(["v2", "v3"]);
    expect(removed.tasks.find((t) => t.id === "b")?.vendorId).toBeUndefined();
    expect(removed.budget.find((l) => l.category === "Catering")?.committed).toBe(0);
  });

  it("adds quotes, moves the vendor to quoted and rejects bad amounts", () => {
    const r = addQuote(vendors(), "v3", { amount: 9_000, includes: "Flowers" }, counterIds());
    expect(r.ok && r.value[2]).toMatchObject({
      status: "quoted",
      quotes: [{ id: "quote_1", amount: 9_000, accepted: false }],
    });
    const booked = vendors().map((v) => ({ ...v, status: "booked" as const }));
    const kept = addQuote(booked, "v1", { amount: 1, includes: "" });
    expect(kept.ok && kept.value[0]?.status).toBe("booked");
    expect(addQuote(vendors(), "zz", { amount: 1, includes: "" })).toEqual({
      ok: false,
      error: "vendor_not_found",
    });
    expect(addQuote(vendors(), "v1", { amount: 0, includes: "" })).toEqual({
      ok: false,
      error: "invalid_amount",
    });
  });
});
