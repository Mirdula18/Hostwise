import {
  displayAnswer,
  fallbackQuestion,
  finalizeProfile,
  isIntakeField,
  keepAnswers,
  normalizeQuestion,
  parseAnswer,
  rawFor,
  reachedLimit,
} from "../../src/lib/intake";
import { sum } from "../../src/lib/money";
import { sampleProfile } from "../../src/lib/sample";
import { starterPlan } from "../../src/lib/starterPlan";
import type { IntakeAnswers } from "../../src/lib/intakeFallback";
import { normalisePercents } from "../../src/lib/budget";
import { AIPlan } from "../../src/schemas/ai";

const TODAY = "2026-11-01";
const required: IntakeAnswers = {
  occasion: "birthday",
  date: "2026-12-20",
  guestCount: 30,
  totalBudget: 500_000,
  currency: "USD",
  priorities: ["food"],
};

describe("parseAnswer", () => {
  it("validates guest count between 1 and 1000", () => {
    expect(parseAnswer("guestCount", "60", TODAY)).toEqual({ ok: true, value: 60 });
    for (const bad of ["0", "1001", "2.5", "", "abc", "-3"]) {
      expect(parseAnswer("guestCount", bad, TODAY).ok).toBe(false);
    }
  });

  it("converts the budget to minor units and rejects zero or negative", () => {
    expect(parseAnswer("totalBudget", "3,00,000", TODAY)).toEqual({ ok: true, value: 30_000_000 });
    expect(parseAnswer("totalBudget", "99.99", TODAY)).toEqual({ ok: true, value: 9999 });
    expect(parseAnswer("totalBudget", "0", TODAY).ok).toBe(false);
    expect(parseAnswer("totalBudget", "-5", TODAY).ok).toBe(false);
    expect(parseAnswer("totalBudget", "1e11", TODAY).ok).toBe(false);
    expect(parseAnswer("totalBudget", "", TODAY).ok).toBe(false);
  });

  it("requires a date in the future", () => {
    expect(parseAnswer("date", "2026-11-02", TODAY)).toEqual({ ok: true, value: "2026-11-02" });
    expect(parseAnswer("date", TODAY, TODAY)).toEqual({
      ok: false,
      error: "Choose a date after today.",
    });
    expect(parseAnswer("date", "2026-13-45", TODAY).ok).toBe(false);
    expect(parseAnswer("date", "soon", TODAY).ok).toBe(false);
  });

  it("validates choices, rankings and age groups", () => {
    expect(parseAnswer("occasion", "anniversary", TODAY).ok).toBe(true);
    expect(parseAnswer("occasion", "wedding", TODAY).ok).toBe(false);
    expect(parseAnswer("currency", "INR", TODAY).ok).toBe(true);
    expect(parseAnswer("currency", "XYZ", TODAY).ok).toBe(false);
    expect(parseAnswer("setting", "outdoor", TODAY).ok).toBe(true);
    expect(parseAnswer("setting", "space", TODAY).ok).toBe(false);
    expect(parseAnswer("priorities", ["food", "x", "venue", "decor", "attire"], TODAY)).toEqual({
      ok: true,
      value: ["food", "venue", "decor"],
    });
    expect(parseAnswer("priorities", [], TODAY).ok).toBe(false);
    expect(parseAnswer("ageMix", ["kids", "aliens"], TODAY)).toEqual({ ok: true, value: ["kids"] });
    expect(parseAnswer("ageMix", [], TODAY).ok).toBe(false);
  });

  it("trims free text and enforces length limits", () => {
    expect(parseAnswer("dietary", "  vegetarian ", TODAY)).toEqual({
      ok: true,
      value: "vegetarian",
    });
    expect(parseAnswer("dietary", "", TODAY).ok).toBe(false);
    expect(parseAnswer("city", "x".repeat(81), TODAY).ok).toBe(false);
    expect(parseAnswer("accessibility", "x".repeat(300), TODAY).ok).toBe(true);
  });
});

describe("normalizeQuestion", () => {
  it("keeps the AI wording but forces code-owned input types and options", () => {
    const q = normalizeQuestion(
      {
        done: false,
        field: "priorities",
        question: "What matters most for Grandma's 80th?",
        inputType: "text",
      },
      {},
      [],
    );
    expect(q).toMatchObject({
      field: "priorities",
      question: "What matters most for Grandma's 80th?",
      inputType: "rank",
    });
    expect(q && !q.done && q.options).toContain("guest_comfort");
  });

  it("returns null for unknown, asked or answered fields", () => {
    expect(
      normalizeQuestion(
        { done: false, field: "shoeSize", question: "?", inputType: "text" },
        {},
        [],
      ),
    ).toBeNull();
    expect(
      normalizeQuestion({ done: false, field: "dietary", question: "?", inputType: "text" }, {}, [
        "dietary",
      ]),
    ).toBeNull();
    expect(
      normalizeQuestion(
        { done: false, field: "occasion", question: "?", inputType: "select" },
        { occasion: "birthday" },
        [],
      ),
    ).toBeNull();
  });

  it("refuses done while required fields are missing", () => {
    expect(normalizeQuestion({ done: true }, {}, [])).toBeNull();
    expect(normalizeQuestion({ done: true }, required, [])).toEqual({ done: true });
  });

  it("falls back to the spec text and helper", () => {
    const q = normalizeQuestion(
      { done: false, field: "guestCount", question: " ", inputType: "number" },
      {},
      [],
    );
    expect(q).toMatchObject({ question: "About how many guests are you expecting?" });
    expect(q && !q.done ? q.helper : "").toMatch(/1000/);
  });
});

describe("profile helpers", () => {
  it("fallbackQuestion and reachedLimit drive the static flow", () => {
    expect(fallbackQuestion({}, [])).toMatchObject({ field: "occasion" });
    expect(
      fallbackQuestion({ ...required, title: "x" }, ["title", "setting", "dietary", "city"]),
    ).toEqual({ done: true });
    expect(reachedLimit(Array(10).fill("x"))).toBe(true);
    expect(isIntakeField("city")).toBe(true);
    expect(isIntakeField(undefined)).toBe(false);
  });

  it("finalizeProfile adds a default title and reports missing fields", () => {
    const r = finalizeProfile(required);
    expect(r.ok && r.value.title).toBe("Birthday on 2026-12-20");
    expect(finalizeProfile({ ...required, title: "Sam turns 30" })).toMatchObject({
      ok: true,
      value: { title: "Sam turns 30" },
    });
    const missing = finalizeProfile({ occasion: "birthday" });
    expect(missing.ok).toBe(false);
  });

  it("displays and re-opens answers in human form", () => {
    const answers = {
      ...required,
      priorities: ["food", "venue"] as ("food" | "venue")[],
      ageMix: ["kids" as const],
    };
    expect(displayAnswer("occasion", answers)).toBe("Birthday");
    expect(displayAnswer("totalBudget", answers)).toBe("$5,000");
    expect(displayAnswer("priorities", answers)).toBe("1. Food, 2. Venue");
    expect(displayAnswer("ageMix", answers)).toBe("kids");
    expect(displayAnswer("city", answers)).toBe("Skipped");
    expect(displayAnswer("guestCount", answers)).toBe("30");
    expect(displayAnswer("totalBudget", { totalBudget: 100 })).toBe("$1");
    expect(rawFor("totalBudget", answers)).toBe("5000");
    expect(rawFor("priorities", answers)).toEqual(["food", "venue"]);
    expect(rawFor("guestCount", answers)).toBe("30");
    expect(rawFor("city", answers)).toBeUndefined();
  });
});

describe("starterPlan", () => {
  it("is a valid plan that leans towards the host's priorities", () => {
    const profile = sampleProfile(TODAY);
    const plan = starterPlan(profile, TODAY);
    expect(AIPlan.safeParse(plan).success).toBe(true);
    const pct = Object.fromEntries(
      plan.budget.map((b, i) => [
        b.category,
        normalisePercents(plan.budget.map((x) => x.percent))[i],
      ]),
    );
    expect(pct.Catering).toBeGreaterThan(pct.Venue ?? 0);
    expect(sum(Object.values(pct).map(Number))).toBe(100);
    expect(plan.tasks.some((t) => t.title.includes("step-free"))).toBe(true);
    expect(plan.tasks.some((t) => t.title.includes("dietary"))).toBe(true);
  });

  it("compresses deadlines into the time left and skips optional tasks", () => {
    const profile = {
      ...sampleProfile(TODAY),
      date: "2026-11-15",
      accessibility: undefined,
      dietary: undefined,
    };
    const plan = starterPlan(profile, TODAY);
    expect(Math.max(...plan.tasks.map((t) => t.dueOffsetDays))).toBeLessThanOrEqual(13);
    expect(plan.tasks).toHaveLength(13);
    expect(
      starterPlan({ ...profile, date: "2026-11-02" }, TODAY).tasks.every(
        (t) => t.dueOffsetDays === 0,
      ),
    ).toBe(true);
  });
});

describe("keepAnswers", () => {
  it("keeps only the listed fields", () => {
    const answers = { occasion: "birthday" as const, guestCount: 40, city: "Pune" };
    expect(keepAnswers(answers, ["occasion", "city"])).toEqual({
      occasion: "birthday",
      city: "Pune",
    });
  });

  it("returns no answers for an empty field list or empty answers", () => {
    expect(keepAnswers({ guestCount: 40 }, [])).toEqual({});
    expect(keepAnswers({}, ["occasion"])).toEqual({});
  });
});
