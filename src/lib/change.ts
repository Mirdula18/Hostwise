import type {
  ActionableChange,
  Adjustment,
  BudgetLine,
  Event,
  Impact,
  TradeOffOption,
} from "../schemas/event";
import {
  giveByPriority,
  headroom,
  scaleForGuests,
  takeInOrder,
  trimOrder,
  usedAmount,
} from "./budget";
import { allocate, format, sum } from "./money";
import { PRIORITY_LABELS } from "./priorities";
import { err, ok, type Result } from "./result";
import { daysBetween, shiftAll, shiftWithDependents, transitiveDependents } from "./timeline";

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
  if (list.length <= 2) return list.join(" and ");
  return `${list.slice(0, 2).join(", ")} and ${list.length - 2} more`;
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

/**
 * Candidate trade-offs that each fully resolve the gap. Code writes the numbers;
 * the AI may only rank and explain them. Locked lines are never adjusted and the
 * top priority is only cut when nothing else fits (then respectsTopPriority=false).
 */
export function generateOptions(event: Event, impact: Impact): TradeOffOption[] {
  const request = impact.request;
  if (request.kind === "unclear") return [];
  const { currency, priorities } = event.profile;
  const top = priorities[0];
  const topLabel = top ? PRIORITY_LABELS[top] : "your top priority";
  const lines = baseLines(event, request);
  const unlocked = lines.filter((l) => !l.locked);
  const nonTop = unlocked.filter((l) => l.priorityTag !== top);
  const options: TradeOffOption[] = [];

  if (impact.gap === 0) {
    return [{ id: "as-is", label: "Apply the change", adjustments: [], respectsTopPriority: true }];
  }

  if (impact.gap < 0) {
    const shortfall = -impact.gap;

    const protect = takeInOrder(trimOrder(nonTop, priorities), shortfall);
    if (protect) {
      const adjustments = toAdjustments(lines, protect);
      options.push({
        id: "protect",
        label: `Protect ${topLabel}; trim ${names(lines, adjustments)}`,
        adjustments,
        respectsTopPriority: true,
      });
    } else {
      const all = takeInOrder(trimOrder(unlocked, priorities), shortfall);
      if (all) {
        options.push({
          id: "trim-all",
          label: `Trim every flexible category, including ${topLabel} (nothing else covers it)`,
          adjustments: toAdjustments(lines, all),
          respectsTopPriority: false,
        });
      }
    }

    const room = nonTop.map(headroom);
    if (sum(room) >= shortfall) {
      const parts = allocate(shortfall, room);
      const deltas = new Map(nonTop.map((l, i) => [l.id, -(parts[i] ?? 0)]));
      const adjustments = toAdjustments(lines, deltas);
      if (!options.some((o) => sameAdjustments(o.adjustments, adjustments))) {
        options.push({
          id: "spread",
          label: `Protect ${topLabel}; trim all other flexible categories a little`,
          adjustments,
          respectsTopPriority: true,
        });
      }
    }

    const old = event.profile.guestCount;
    if (request.kind === "guests" && request.newCount > old) {
      const half = old + Math.floor((request.newCount - old) / 2);
      const halfFit = half > old ? fitGuests(event, half) : null;
      const count = halfFit ? half : old;
      const fit = halfFit ?? fitGuests(event, old);
      if (fit) {
        const adjustments = toAdjustments(fit.lines, fit.deltas);
        const trimmed = adjustments.filter((a) => a.delta < 0);
        options.push({
          id: "trim-guests",
          label:
            count === old
              ? `Keep the guest list at ${old}`
              : `Invite ${count - old} more guests instead of ${request.newCount - old}` +
                (trimmed.length > 0 ? `; trim ${names(fit.lines, trimmed)}` : ""),
          adjustments,
          guestCountChange: count - request.newCount,
          respectsTopPriority: true,
        });
      }
    }

    options.push({
      id: "raise-budget",
      label: `Raise the budget by ${format(shortfall, currency)}`,
      adjustments: [],
      budgetChange: shortfall,
      respectsTopPriority: true,
    });
    return options;
  }

  const surplus = impact.gap;
  if (unlocked.length > 0) {
    options.push({
      id: "boost-priorities",
      label: `Put more into ${priorities.map((p) => PRIORITY_LABELS[p]).join(", ")}`,
      adjustments: toAdjustments(lines, giveByPriority(unlocked, surplus, priorities)),
      respectsTopPriority: true,
    });
    const parts = allocate(
      surplus,
      unlocked.map((l) => l.allocated),
    );
    const evenly = toAdjustments(lines, new Map(unlocked.map((l, i) => [l.id, parts[i] ?? 0])));
    if (!options.some((o) => sameAdjustments(o.adjustments, evenly))) {
      options.push({
        id: "spread-extra",
        label: "Spread the extra across every unlocked category",
        adjustments: evenly,
        respectsTopPriority: true,
      });
    }
  }
  if (request.kind === "guests") {
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

export type ApplyError =
  "unknown_category" | "locked_category" | "below_committed" | "unbalanced" | "unknown_task";

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
  let profile = { ...event.profile };
  let tasks = event.tasks;
  let lines: BudgetLine[] = event.budget;
  const total = totalAfter(event, request) + (option.budgetChange ?? 0);

  switch (request.kind) {
    case "guests": {
      const count = request.newCount + (option.guestCountChange ?? 0);
      lines = scaleForGuests(event.budget, event.profile.guestCount, count);
      profile = { ...profile, guestCount: count };
      break;
    }
    case "date":
      tasks = shiftAll(event.tasks, daysBetween(event.profile.date, request.newDate));
      profile = { ...profile, date: request.newDate };
      break;
    case "delay": {
      const shifted = shiftWithDependents(event.tasks, request.taskId, request.days, profile.date);
      if (!shifted.ok) return err("unknown_task");
      tasks = shifted.value.tasks;
      break;
    }
    case "budget":
      break;
  }

  const byCategory = new Map(lines.map((l) => [l.category, l]));
  const deltas = new Map<string, number>();
  for (const a of option.adjustments) {
    const line = byCategory.get(a.category);
    if (!line) return err("unknown_category");
    if (line.locked && a.delta !== 0) return err("locked_category");
    deltas.set(line.id, (deltas.get(line.id) ?? 0) + a.delta);
  }
  lines = lines.map((l) => {
    const d = deltas.get(l.id);
    return d ? { ...l, allocated: l.allocated + d } : l;
  });
  if (lines.some((l) => l.allocated < usedAmount(l))) return err("below_committed");
  if (sum(lines.map((l) => l.allocated)) !== total) return err("unbalanced");

  return ok({
    ...event,
    profile: { ...profile, totalBudget: total },
    budget: lines,
    tasks,
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
