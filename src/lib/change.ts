import {
  giveByPriority,
  headroom,
  scaleForGuests,
  takeInOrder,
  trimOrder,
  usedAmount,
} from "./budget";
import { LIMITS } from "./constants";
import { allocate, format, sum } from "./money";
import { PRIORITY_LABELS } from "./priorities";
import { err, ok, type Result } from "./result";
import { daysBetween, shiftAll, shiftWithDependents, transitiveDependents } from "./timeline";
import type {
  ActionableChange,
  Adjustment,
  BudgetLine,
  Event,
  Impact,
  Task,
  TradeOffOption,
} from "../schemas/event";

/** The guest-fit option invites half of the extra guests. */
const HALF = 2;

const GUEST_TASK = /head ?count|guest|rsvp|invit|cater|seat|favou?r/i;

/** Budget lines as they would be right after the change, before any trade-off. */
export function baseLines(event: Event, request: ActionableChange): BudgetLine[] {
  return request.kind === "guests"
    ? scaleForGuests(event.budget, event.profile.guestCount, request.newCount)
    : [...event.budget];
}

function totalAfter(event: Event, request: ActionableChange): number {
  return request.kind === "budget" ? request.newTotal : event.profile.totalBudget;
}

/** What a change does to money and tasks, before the host picks a trade-off. */
export function computeImpact(event: Event, request: ActionableChange): Impact {
  const lines = baseLines(event, request);
  const total = totalAfter(event, request);
  const requiredSum = sum(lines.map((l) => l.allocated));
  const open = event.tasks.filter((t) => t.status !== "done");

  let affectedCategories: string[] = [];
  let affectedTaskIds: string[] = [];
  switch (request.kind) {
    case "guests":
      affectedCategories = lines
        .filter((l, i) => l.allocated !== event.budget[i]?.allocated)
        .map((l) => l.category);
      affectedTaskIds = open.filter((t) => GUEST_TASK.test(t.title)).map((t) => t.id);
      break;
    case "budget":
      affectedCategories = event.budget.filter((l) => !l.locked).map((l) => l.category);
      break;
    case "date":
      affectedTaskIds = open.map((t) => t.id);
      break;
    case "delay":
      affectedTaskIds = event.tasks.some((t) => t.id === request.taskId)
        ? [request.taskId, ...transitiveDependents(event.tasks, request.taskId)]
        : [];
      break;
  }

  return {
    request,
    before: {
      total: event.profile.totalBudget,
      allocatedSum: sum(event.budget.map((l) => l.allocated)),
    },
    after: { total, requiredSum },
    gap: total - requiredSum,
    affectedCategories,
    affectedTaskIds,
  };
}

function toAdjustments(lines: readonly BudgetLine[], deltas: ReadonlyMap<string, number>) {
  return lines
    .filter((l) => (deltas.get(l.id) ?? 0) !== 0)
    .map((l) => ({ category: l.category, delta: deltas.get(l.id) ?? 0 }));
}

function respectsTop(event: Event, adjustments: readonly Adjustment[]): boolean {
  const top = event.profile.priorities[0];
  return !adjustments.some(
    (a) => a.delta < 0 && event.budget.find((l) => l.category === a.category)?.priorityTag === top,
  );
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

/** One-line summary of a change for the change log. */
export function describeChange(event: Event, request: ActionableChange): string {
  const { profile } = event;
  switch (request.kind) {
    case "budget":
      return `Budget ${format(profile.totalBudget, profile.currency)} → ${format(request.newTotal, profile.currency)}`;
    case "guests":
      return `Guests ${profile.guestCount} → ${request.newCount}`;
    case "date":
      return `Event date ${profile.date} → ${request.newDate}`;
    case "delay": {
      const title = event.tasks.find((t) => t.id === request.taskId)?.title ?? "A task";
      return `"${title}" delayed by ${request.days} day${request.days === 1 ? "" : "s"}`;
    }
  }
}

/** Why an option could not be applied; the event is left unchanged. */
export type ApplyError =
  "unknown_category" | "locked_category" | "below_committed" | "unbalanced" | "unknown_task";

type Applied = { profile: Event["profile"]; tasks: Task[]; lines: BudgetLine[] };

/** Applies the non-budget part of a change: guest scaling, date or delay shifts. */
function applyRequest(
  event: Event,
  request: ActionableChange,
  option: TradeOffOption,
): Result<Applied, ApplyError> {
  const base: Applied = { profile: { ...event.profile }, tasks: event.tasks, lines: event.budget };
  switch (request.kind) {
    case "guests": {
      const count = request.newCount + (option.guestCountChange ?? 0);
      return ok({
        ...base,
        lines: scaleForGuests(event.budget, event.profile.guestCount, count),
        profile: { ...base.profile, guestCount: count },
      });
    }
    case "date":
      return ok({
        ...base,
        tasks: shiftAll(event.tasks, daysBetween(event.profile.date, request.newDate)),
        profile: { ...base.profile, date: request.newDate },
      });
    case "delay": {
      const shifted = shiftWithDependents(
        event.tasks,
        request.taskId,
        request.days,
        event.profile.date,
      );
      return shifted.ok ? ok({ ...base, tasks: shifted.value.tasks }) : err("unknown_task");
    }
    case "budget":
      return ok(base);
  }
}

/** Applies category deltas, rejecting unknown or locked categories and cuts below what is used. */
function applyAdjustments(
  lines: readonly BudgetLine[],
  adjustments: readonly Adjustment[],
  total: number,
): Result<BudgetLine[], ApplyError> {
  const byCategory = new Map(lines.map((l) => [l.category, l]));
  const deltas = new Map<string, number>();
  for (const a of adjustments) {
    const line = byCategory.get(a.category);
    if (!line) return err("unknown_category");
    if (line.locked && a.delta !== 0) return err("locked_category");
    deltas.set(line.id, (deltas.get(line.id) ?? 0) + a.delta);
  }
  const next = lines.map((l) => {
    const d = deltas.get(l.id);
    return d ? { ...l, allocated: l.allocated + d } : l;
  });
  if (next.some((l) => l.allocated < usedAmount(l))) return err("below_committed");
  if (sum(next.map((l) => l.allocated)) !== total) return err("unbalanced");
  return ok(next);
}

/**
 * Applies a chosen option and returns a new event (the input is not mutated).
 * Every result is re-checked: no locked line moved, no line below what is committed,
 * and allocations sum exactly to the total.
 */
export function applyOption(
  event: Event,
  impact: Impact,
  option: TradeOffOption,
  now: string = new Date().toISOString(),
): Result<Event, ApplyError> {
  const request = impact.request;
  if (request.kind === "unclear") return err("unbalanced");
  const total = totalAfter(event, request) + (option.budgetChange ?? 0);
  const applied = applyRequest(event, request, option);
  if (!applied.ok) return applied;
  const lines = applyAdjustments(applied.value.lines, option.adjustments, total);
  if (!lines.ok) return lines;
  return ok({
    ...event,
    profile: { ...applied.value.profile, totalBudget: total },
    budget: lines.value,
    tasks: applied.value.tasks,
    changeLog: [
      ...event.changeLog,
      { at: now, summary: `${describeChange(event, request)}: ${option.label}` },
    ],
    updatedAt: now,
  });
}

/**
 * Checks an AI-proposed custom option. Returns a usable option, or null when it
 * names unknown or locked categories or does not balance exactly.
 */
export function validateCustomOption(
  event: Event,
  impact: Impact,
  custom: { label: string; adjustments: Adjustment[] },
): TradeOffOption | null {
  const option: TradeOffOption = {
    id: "custom",
    label: custom.label.trim() || "Custom mix",
    adjustments: custom.adjustments.filter((a) => a.delta !== 0),
    respectsTopPriority: respectsTop(event, custom.adjustments),
  };
  if (option.adjustments.length === 0) return null;
  return applyOption(event, impact, option).ok ? option : null;
}
