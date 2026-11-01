/** Code-generated trade-off options. Each one balances the budget exactly; the AI only ranks them. */

import { giveByPriority, headroom, scaleForGuests, takeInOrder, trimOrder } from "./budget";
import { LIMITS } from "./constants";
import { baseLines } from "./impact";
import { allocate, format, sum } from "./money";
import { PRIORITY_LABELS } from "./priorities";
import type {
  ActionableChange,
  Adjustment,
  BudgetLine,
  Event,
  Impact,
  TradeOffOption,
} from "../schemas/event";

/** The guest-fit option invites half of the extra guests. */
const HALF = 2;

/** Turns per-line deltas into category adjustments (zero deltas are dropped). */
function toAdjustments(lines: readonly BudgetLine[], deltas: ReadonlyMap<string, number>) {
  return lines
    .filter((l) => (deltas.get(l.id) ?? 0) !== 0)
    .map((l) => ({ category: l.category, delta: deltas.get(l.id) ?? 0 }));
}

function names(lines: readonly BudgetLine[], adjustments: readonly Adjustment[]): string {
  const cats = adjustments.map((a) => a.category);
  const list = lines.filter((l) => cats.includes(l.category)).map((l) => l.category);
  const shown = LIMITS.SUMMARY_ITEMS;
  if (list.length <= shown) return list.join(" and ");
  return `${list.slice(0, shown).join(", ")} and ${list.length - shown} more`;
}

function sameAdjustments(a: readonly Adjustment[], b: readonly Adjustment[]): boolean {
  const key = (x: readonly Adjustment[]) =>
    JSON.stringify([...x].sort((p, q) => p.category.localeCompare(q.category)));
  return key(a) === key(b);
}

/**
 * Balances the budget for `count` guests without touching the top priority:
 * a surplus is shared by priority, a shortfall is trimmed from the least important
 * lines. Returns null when that is not possible.
 */
function fitGuests(
  event: Event,
  count: number,
): { lines: BudgetLine[]; deltas: Map<string, number> } | null {
  const { guestCount: old, totalBudget, priorities } = event.profile;
  const lines = scaleForGuests(event.budget, old, count);
  const diff = totalBudget - sum(lines.map((l) => l.allocated));
  const unlocked = lines.filter((l) => !l.locked);
  if (diff >= 0) {
    if (diff > 0 && unlocked.length === 0) return null;
    return { lines, deltas: giveByPriority(unlocked, diff, priorities) };
  }
  const nonTop = unlocked.filter((l) => l.priorityTag !== priorities[0]);
  const deltas = takeInOrder(trimOrder(nonTop, priorities), -diff);
  return deltas ? { lines, deltas } : null;
}

/** Shared inputs for building options; `lines` is the post-change baseline. */
type OptionContext = {
  event: Event;
  request: ActionableChange;
  lines: BudgetLine[];
  unlocked: BudgetLine[];
  nonTop: BudgetLine[];
  topLabel: string;
};

function optionContext(event: Event, request: ActionableChange): OptionContext {
  const top = event.profile.priorities[0];
  const lines = baseLines(event, request);
  const unlocked = lines.filter((l) => !l.locked);
  return {
    event,
    request,
    lines,
    unlocked,
    nonTop: unlocked.filter((l) => l.priorityTag !== top),
    topLabel: top ? PRIORITY_LABELS[top] : "your top priority",
  };
}

const pushUnique = (options: TradeOffOption[], option: TradeOffOption): void => {
  if (!options.some((o) => sameAdjustments(o.adjustments, option.adjustments))) {
    options.push(option);
  }
};

/** Trim the least important lines first; falls back to every unlocked line. */
function protectOption(ctx: OptionContext, shortfall: number): TradeOffOption | null {
  const { priorities } = ctx.event.profile;
  const protect = takeInOrder(trimOrder(ctx.nonTop, priorities), shortfall);
  if (protect) {
    const adjustments = toAdjustments(ctx.lines, protect);
    return {
      id: "protect",
      label: `Protect ${ctx.topLabel}; trim ${names(ctx.lines, adjustments)}`,
      adjustments,
      respectsTopPriority: true,
    };
  }
  const all = takeInOrder(trimOrder(ctx.unlocked, priorities), shortfall);
  if (!all) return null;
  return {
    id: "trim-all",
    label: `Trim every flexible category, including ${ctx.topLabel} (nothing else covers it)`,
    adjustments: toAdjustments(ctx.lines, all),
    respectsTopPriority: false,
  };
}

/** Share the cut across every non-top line in proportion to its headroom. */
function spreadOption(ctx: OptionContext, shortfall: number): TradeOffOption | null {
  const room = ctx.nonTop.map(headroom);
  if (sum(room) < shortfall) return null;
  const parts = allocate(shortfall, room);
  const deltas = new Map(ctx.nonTop.map((l, i) => [l.id, -(parts[i] ?? 0)]));
  return {
    id: "spread",
    label: `Protect ${ctx.topLabel}; trim all other flexible categories a little`,
    adjustments: toAdjustments(ctx.lines, deltas),
    respectsTopPriority: true,
  };
}

/** Invite half of the extra guests (or none) and balance without the top priority. */
function guestFitOption(event: Event, newCount: number): TradeOffOption | null {
  const old = event.profile.guestCount;
  const half = old + Math.floor((newCount - old) / HALF);
  const halfFit = half > old ? fitGuests(event, half) : null;
  const count = halfFit ? half : old;
  const fit = halfFit ?? fitGuests(event, old);
  if (!fit) return null;
  const adjustments = toAdjustments(fit.lines, fit.deltas);
  const trimmed = adjustments.filter((a) => a.delta < 0);
  const trimNote = trimmed.length > 0 ? `; trim ${names(fit.lines, trimmed)}` : "";
  return {
    id: "trim-guests",
    label:
      count === old
        ? `Keep the guest list at ${old}`
        : `Invite ${count - old} more guests instead of ${newCount - old}${trimNote}`,
    adjustments,
    guestCountChange: count - newCount,
    respectsTopPriority: true,
  };
}

function shortfallOptions(ctx: OptionContext, shortfall: number): TradeOffOption[] {
  const options: TradeOffOption[] = [];
  const protect = protectOption(ctx, shortfall);
  if (protect) options.push(protect);
  const spread = spreadOption(ctx, shortfall);
  if (spread) pushUnique(options, spread);
  const { request, event } = ctx;
  if (request.kind === "guests" && request.newCount > event.profile.guestCount) {
    const fit = guestFitOption(event, request.newCount);
    if (fit) options.push(fit);
  }
  options.push({
    id: "raise-budget",
    label: `Raise the budget by ${format(shortfall, event.profile.currency)}`,
    adjustments: [],
    budgetChange: shortfall,
    respectsTopPriority: true,
  });
  return options;
}

function surplusOptions(ctx: OptionContext, surplus: number): TradeOffOption[] {
  const { priorities, currency } = ctx.event.profile;
  const options: TradeOffOption[] = [];
  if (ctx.unlocked.length > 0) {
    options.push({
      id: "boost-priorities",
      label: `Put more into ${priorities.map((p) => PRIORITY_LABELS[p]).join(", ")}`,
      adjustments: toAdjustments(ctx.lines, giveByPriority(ctx.unlocked, surplus, priorities)),
      respectsTopPriority: true,
    });
    const parts = allocate(
      surplus,
      ctx.unlocked.map((l) => l.allocated),
    );
    pushUnique(options, {
      id: "spread-extra",
      label: "Spread the extra across every unlocked category",
      adjustments: toAdjustments(
        ctx.lines,
        new Map(ctx.unlocked.map((l, i) => [l.id, parts[i] ?? 0])),
      ),
      respectsTopPriority: true,
    });
  }
  if (ctx.request.kind === "guests") {
    options.push({
      id: "lower-budget",
      label: `Lower the budget by ${format(surplus, currency)} and keep the savings`,
      adjustments: [],
      budgetChange: -surplus,
      respectsTopPriority: true,
    });
  }
  return options;
}

/**
 * Candidate trade-offs that each fully resolve the gap. Code writes the numbers;
 * the AI may only rank and explain them. Locked lines are never adjusted and the
 * top priority is only cut when nothing else fits (then respectsTopPriority=false).
 */
export function generateOptions(event: Event, impact: Impact): TradeOffOption[] {
  const request = impact.request;
  if (request.kind === "unclear") return [];
  if (impact.gap === 0) {
    return [{ id: "as-is", label: "Apply the change", adjustments: [], respectsTopPriority: true }];
  }
  const ctx = optionContext(event, request);
  return impact.gap < 0 ? shortfallOptions(ctx, -impact.gap) : surplusOptions(ctx, impact.gap);
}
