import type { AIPlan } from "../schemas/ai";
import type { Event, EventProfile } from "../schemas/event";
import { fromPercents } from "./budget";
import { makeId, type IdGen } from "./id";
import { toDates } from "./timeline";

/** Gives repeated category names a numeric suffix so adjustments can target them. */
function uniqueCategories(plan: AIPlan): AIPlan["budget"] {
  const seen = new Map<string, number>();
  return plan.budget.map((item) => {
    const key = item.category.trim().toLowerCase();
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return n === 1 ? item : { ...item, category: `${item.category.slice(0, 34)} (${n})` };
  });
}

/**
 * Converts a validated AI plan into an event. Code does all the arithmetic:
 * percentages become exact money amounts and day offsets become dates.
 */
export function planToEvent(
  profile: EventProfile,
  plan: AIPlan,
  now: string = new Date().toISOString(),
  idGen: IdGen = makeId,
): Event {
  const budget = fromPercents(uniqueCategories(plan), profile.totalBudget, idGen);
  const { tasks, notes } = toDates(plan.tasks, profile.date, idGen);
  return {
    id: idGen("event"),
    profile,
    budget,
    tasks,
    vendors: [],
    theme: plan.theme.slice(0, 600),
    assumptions: [...plan.assumptions, ...notes].map((a) => a.slice(0, 200)),
    changeLog: [],
    createdAt: now,
    updatedAt: now,
  };
}
