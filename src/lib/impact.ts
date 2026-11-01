/** What a change does to the plan before any trade-off is chosen. */

import { scaleForGuests } from "./budget";
import { format, sum } from "./money";
import { transitiveDependents } from "./taskGraph";
import type { ActionableChange, BudgetLine, Event, Impact } from "../schemas/event";

const GUEST_TASK = /head ?count|guest|rsvp|invit|cater|seat|favou?r/i;

/** Budget lines as they would be right after the change, before any trade-off. */
export function baseLines(event: Event, request: ActionableChange): BudgetLine[] {
  return request.kind === "guests"
    ? scaleForGuests(event.budget, event.profile.guestCount, request.newCount)
    : [...event.budget];
}

/** The total budget once the change is applied (only a budget change moves it). */
export function totalAfter(event: Event, request: ActionableChange): number {
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
