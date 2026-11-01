/** Applying a chosen option: every result is re-checked before it is saved. */

import { scaleForGuests, usedAmount } from "./budget";
import { daysBetween } from "./dates";
import { describeChange, totalAfter } from "./impact";
import { sum } from "./money";
import { err, ok, type Result } from "./result";
import { shiftAll, shiftWithDependents } from "./timeline";
import type {
  ActionableChange,
  Adjustment,
  BudgetLine,
  Event,
  Impact,
  Task,
  TradeOffOption,
} from "../schemas/event";

function respectsTop(event: Event, adjustments: readonly Adjustment[]): boolean {
  const top = event.profile.priorities[0];
  return !adjustments.some(
    (a) => a.delta < 0 && event.budget.find((l) => l.category === a.category)?.priorityTag === top,
  );
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
