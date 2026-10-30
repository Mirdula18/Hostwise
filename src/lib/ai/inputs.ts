import { LIMITS } from "../constants";
import type { Event, Impact, TradeOffOption } from "../../schemas/event";

/** Payloads for the AI tasks. Only the fields each prompt needs leave the browser. */

/** Input for `parse_change`: the host's words plus the numbers needed to resolve them. */
export function parseChangeInput(event: Event, text: string, today: string) {
  const { profile } = event;
  return {
    text,
    today,
    eventDate: profile.date,
    currency: profile.currency,
    guestCount: profile.guestCount,
    totalBudget: profile.totalBudget,
    tasks: event.tasks
      .filter((t) => t.status !== "done")
      .slice(0, LIMITS.CHANGE_TASKS_MAX)
      .map((t) => ({ id: t.id, title: t.title })),
  };
}

/** Input for `rank_options`: priorities, the impact, code-made options and lock state. */
export function rankOptionsInput(event: Event, impact: Impact, options: TradeOffOption[]) {
  const { priorities, guestCount, occasion } = event.profile;
  return {
    profile: { priorities, guestCount, occasion },
    impact,
    options,
    categories: event.budget.map((l) => ({
      category: l.category,
      allocated: l.allocated,
      locked: l.locked,
    })),
  };
}
