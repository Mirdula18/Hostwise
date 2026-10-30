import { LIMITS, TEXT } from "../../src/lib/constants";
import { delayDays, quickChange, quoteInput, taskInput, vendorInput } from "../../src/lib/forms";

const vendor = { name: "Annapurna", category: "Catering", status: "considering" as const };

describe("vendorInput", () => {
  it("requires a name", () => {
    expect(vendorInput({ ...vendor, name: "   ", contact: "", notes: "" })).toEqual({
      ok: false,
      error: "Enter the vendor's name.",
    });
  });

  it("trims, clips and leaves out blank optional fields", () => {
    const r = vendorInput({
      ...vendor,
      name: ` ${"n".repeat(TEXT.NAME + 5)} `,
      contact: " ",
      notes: "",
    });
    expect(r.ok && r.value).toEqual({ ...vendor, name: "n".repeat(TEXT.NAME) });
  });

  it("keeps contact and notes when given", () => {
    const r = vendorInput({ ...vendor, contact: " 98765 ", notes: " Jain options " });
    expect(r.ok && r.value).toMatchObject({ contact: "98765", notes: "Jain options" });
  });
});

describe("quoteInput", () => {
  const base = {
    amount: "1,08,000",
    includes: " Buffet ",
    deposit: "",
    validUntil: "",
    cancellation: "",
  };

  it("converts the amount to minor units and omits blank optional fields", () => {
    expect(quoteInput(base)).toEqual({
      ok: true,
      value: { amount: 10_800_000, includes: "Buffet" },
    });
  });

  it.each(["", "0", "-5", "abc"])("rejects an amount of %j", (amount) => {
    expect(quoteInput({ ...base, amount })).toEqual({
      ok: false,
      error: "Enter the quoted amount, above 0.",
    });
  });

  it("rejects a deposit that is not a number", () => {
    expect(quoteInput({ ...base, deposit: "half" })).toEqual({
      ok: false,
      error: "Enter the deposit as a number, or leave it blank.",
    });
  });

  it("keeps deposit, validity date and cancellation terms when given", () => {
    const r = quoteInput({
      ...base,
      deposit: "0",
      validUntil: "2026-12-01",
      cancellation: " 14 days ",
    });
    expect(r.ok && r.value).toMatchObject({
      deposit: 0,
      validUntil: "2026-12-01",
      cancellation: "14 days",
    });
  });
});

describe("taskInput", () => {
  const base = { title: "Book DJ", category: " Music ", dueDate: "2026-12-01", dependsOn: ["t1"] };

  it("trims the title and clips the category", () => {
    expect(taskInput({ ...base, category: "c".repeat(TEXT.LABEL + 1) })).toEqual({
      ok: true,
      value: { ...base, category: "c".repeat(TEXT.LABEL) },
    });
    expect(taskInput({ ...base, title: "  Book DJ  " }).ok).toBe(true);
  });

  it("rejects an empty or over-long title", () => {
    const message = `Give the task a title (up to ${TEXT.TITLE} characters).`;
    expect(taskInput({ ...base, title: " " })).toEqual({ ok: false, error: message });
    expect(taskInput({ ...base, title: "t".repeat(TEXT.TITLE + 1) })).toEqual({
      ok: false,
      error: message,
    });
  });

  it("requires a due date", () => {
    expect(taskInput({ ...base, dueDate: "" })).toEqual({ ok: false, error: "Choose a due date." });
  });
});

describe("quickChange", () => {
  it("parses a new budget into minor units, rejecting zero and text", () => {
    expect(quickChange("budget", "2,40,000", "")).toEqual({
      ok: true,
      value: { kind: "budget", newTotal: 24_000_000 },
    });
    expect(quickChange("budget", "0", "").ok).toBe(false);
    expect(quickChange("budget", "lots", "").ok).toBe(false);
  });

  it("accepts guest counts from 1 to the maximum only", () => {
    expect(quickChange("guests", "80", "")).toEqual({
      ok: true,
      value: { kind: "guests", newCount: 80 },
    });
    for (const bad of ["0", "-3", "2.5", String(LIMITS.GUESTS_MAX + 1), ""]) {
      expect(quickChange("guests", bad, "")).toEqual({
        ok: false,
        error: `Enter a whole number of guests between 1 and ${LIMITS.GUESTS_MAX}.`,
      });
    }
  });

  it("needs an ISO date for a date change", () => {
    expect(quickChange("date", "2026-12-20", "")).toEqual({
      ok: true,
      value: { kind: "date", newDate: "2026-12-20" },
    });
    expect(quickChange("date", "20/12/2026", "")).toEqual({
      ok: false,
      error: "Choose the new date.",
    });
  });

  it("builds a delay for the chosen task within the day limit", () => {
    expect(quickChange("delay", "5", "t3")).toEqual({
      ok: true,
      value: { kind: "delay", taskId: "t3", days: 5 },
    });
    expect(quickChange("delay", String(LIMITS.DELAY_DAYS_MAX + 1), "t3")).toEqual({
      ok: false,
      error: `Enter a delay between 1 and ${LIMITS.DELAY_DAYS_MAX} days.`,
    });
  });
});

describe("delayDays", () => {
  it("returns whole days in range, otherwise null", () => {
    expect(delayDays("1")).toBe(1);
    expect(delayDays(String(LIMITS.DELAY_DAYS_MAX))).toBe(LIMITS.DELAY_DAYS_MAX);
    expect(delayDays("0")).toBeNull();
    expect(delayDays("-1")).toBeNull();
    expect(delayDays("1.5")).toBeNull();
    expect(delayDays("")).toBeNull();
  });
});
