import type { RankResult } from "../schemas/ai";
import type {
  ActionableChange,
  ChangeRequest,
  Event,
  Impact,
  TradeOffOption,
} from "../schemas/event";
import { validateCustomOption } from "./change";
import { format } from "./money";
import { err, ok, type Result } from "./result";
import { isFutureDate } from "./timeline";

export type RankedOption = TradeOffOption & {
  rank: number;
  why?: string;
  whatTheyGiveUp?: string;
  aiSuggested?: boolean;
};

/**
 * Orders code-generated options by the AI ranking and attaches its explanations.
 * Unknown ids are ignored, options the AI skipped keep code order at the end, and
 * the AI's custom option is kept only if code validation accepts it.
 */
export function mergeRanking(
  event: Event,
  impact: Impact,
  options: readonly TradeOffOption[],
  ranking: RankResult | null,
): RankedOption[] {
  const byId = new Map(options.map((o) => [o.id, o]));
  const seen = new Set<string>();
  const ordered: RankedOption[] = [];
  for (const r of ranking?.ranking ?? []) {
    const option = byId.get(r.optionId);
    if (!option || seen.has(option.id)) continue;
    seen.add(option.id);
    ordered.push({ ...option, rank: 0, why: r.why, whatTheyGiveUp: r.whatTheyGiveUp });
  }
  for (const option of options) {
    if (!seen.has(option.id)) ordered.push({ ...option, rank: 0 });
  }
  if (ranking?.custom) {
    const custom = validateCustomOption(event, impact, ranking.custom);
    if (custom) ordered.push({ ...custom, rank: 0, why: ranking.custom.why, aiSuggested: true });
  }
  return ordered.map((o, i) => ({ ...o, rank: i + 1 }));
}

/**
 * Sanity-checks a change before the engine runs: rejects no-op changes, past dates
 * and unknown tasks with a message the host can act on.
 */
export function checkChange(
  event: Event,
  request: ChangeRequest,
  today: string,
): Result<ActionableChange, string> {
  const { profile } = event;
  switch (request.kind) {
    case "unclear":
      return err(request.clarifyingQuestion);
    case "budget":
      return request.newTotal === profile.totalBudget
        ? err(`Your budget is already ${format(profile.totalBudget, profile.currency)}.`)
        : ok(request);
    case "guests":
      return request.newCount === profile.guestCount
        ? err(`You already have ${profile.guestCount} guests planned.`)
        : ok(request);
    case "date":
      if (request.newDate === profile.date) return err(`The event is already on ${profile.date}.`);
      return isFutureDate(request.newDate, today)
        ? ok(request)
        : err("The new date needs to be after today.");
    case "delay":
      return event.tasks.some((t) => t.id === request.taskId)
        ? ok(request)
        : err("Which task is delayed? Choose it with the Vendor delay button.");
  }
}

type DiffLine = { category: string; before: number; after: number; delta: number };
type DiffTask = { id: string; title: string; before: string; after: string };
export type EventDiff = {
  lines: DiffLine[];
  total: { before: number; after: number };
  guests: { before: number; after: number };
  date: { before: string; after: string };
  tasks: DiffTask[];
};

/** Before/after comparison of two versions of the same event, for the preview table. */
export function diffEvents(before: Event, after: Event): EventDiff {
  const old = new Map(before.budget.map((l) => [l.id, l.allocated]));
  const oldTasks = new Map(before.tasks.map((t) => [t.id, t.dueDate]));
  return {
    lines: after.budget.map((l) => {
      const b = old.get(l.id) ?? 0;
      return { category: l.category, before: b, after: l.allocated, delta: l.allocated - b };
    }),
    total: { before: before.profile.totalBudget, after: after.profile.totalBudget },
    guests: { before: before.profile.guestCount, after: after.profile.guestCount },
    date: { before: before.profile.date, after: after.profile.date },
    tasks: after.tasks
      .filter((t) => oldTasks.get(t.id) !== t.dueDate)
      .map((t) => ({
        id: t.id,
        title: t.title,
        before: oldTasks.get(t.id) ?? "",
        after: t.dueDate,
      })),
  };
}
