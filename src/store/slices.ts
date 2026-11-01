/** Store actions, grouped by area. Each action runs pure lib code and saves the result. */
import { without, type Actions, type EditMode, type Kit } from "./kit";
import { rebalance, setLineAmount, setSpent, toggleLock } from "../lib/budget";
import { computeImpact } from "../lib/impact";
import { importEvents as parseImport } from "../lib/io";
import { err, ok } from "../lib/result";
import {
  addTask as addTaskLib,
  deleteTask as deleteTaskLib,
  updateTask as updateTaskLib,
} from "../lib/taskEdit";
import { generateOptions } from "../lib/tradeOffs";
import {
  acceptQuote as acceptQuoteLib,
  addQuote as addQuoteLib,
  addVendor as addVendorLib,
  removeVendor as removeVendorLib,
  syncCommitted,
  unacceptQuote as unacceptQuoteLib,
  updateVendor as updateVendorLib,
} from "../lib/vendors";
import type { Event } from "../schemas/event";

type EventActions = Pick<
  Actions,
  "createEvent" | "setActive" | "deleteEvent" | "applyChange" | "undo" | "importEvents"
>;

export function eventActions({ set, get, commitChange }: Kit): EventActions {
  return {
    createEvent: (event) => {
      set((s) => ({ events: { ...s.events, [event.id]: event }, activeId: event.id }));
      return event.id;
    },
    setActive: (id) => set({ activeId: id }),
    deleteEvent: (id) =>
      set((s) => ({
        events: without(s.events, id),
        history: without(s.history, id),
        activeId: s.activeId === id ? null : s.activeId,
      })),
    applyChange: (eventId, impact, option) => commitChange(eventId, impact, option),
    undo: (eventId) => {
      const stack = get().history[eventId] ?? [];
      const previous = stack[stack.length - 1];
      if (!previous) return false;
      set((s) => ({
        events: { ...s.events, [eventId]: previous },
        history: { ...s.history, [eventId]: stack.slice(0, -1) },
      }));
      return true;
    },
    importEvents: (text) => {
      const r = parseImport(text);
      if (!r.ok) return r;
      set((s) => ({
        events: { ...s.events, ...Object.fromEntries(r.value.map((e) => [e.id, e])) },
      }));
      return ok(r.value.length);
    },
  };
}

/** Rebalance keeps the total; changeTotal moves it by the line's difference. */
function editLine(e: Event, lineId: string, amount: number, mode: EditMode) {
  if (mode === "rebalance") {
    const lines = rebalance(e.budget, lineId, amount, e.profile.priorities);
    return lines.ok ? ok({ ...e, budget: lines.value }) : lines;
  }
  const changed = setLineAmount(e.budget, lineId, amount);
  if (!changed.ok) return changed;
  const totalBudget = Math.max(1, changed.value.total);
  return ok({ ...e, budget: changed.value.lines, profile: { ...e.profile, totalBudget } });
}

type BudgetActions = Pick<Actions, "updateBudgetLine" | "lockLine" | "setLineSpent">;

export function budgetActions({ edit }: Kit): BudgetActions {
  return {
    updateBudgetLine: (eventId, lineId, amount, mode) =>
      edit(eventId, (e) => editLine(e, lineId, amount, mode)),
    lockLine: (eventId, lineId) => {
      edit(eventId, (e) => ok({ ...e, budget: toggleLock(e.budget, lineId) }));
    },
    setLineSpent: (eventId, lineId, spent) =>
      edit(eventId, (e) => {
        const lines = setSpent(e.budget, lineId, spent);
        return lines.ok ? ok({ ...e, budget: lines.value }) : lines;
      }),
  };
}

type TaskActions = Pick<Actions, "addTask" | "updateTask" | "deleteTask" | "delayTask">;

export function taskActions({ get, edit, commitChange }: Kit): TaskActions {
  return {
    addTask: (eventId, input) =>
      edit(eventId, (e) => {
        const tasks = addTaskLib(e.tasks, input);
        return tasks.ok ? ok({ ...e, tasks: tasks.value }) : tasks;
      }),
    updateTask: (eventId, taskId, patch) =>
      edit(eventId, (e) => {
        const tasks = updateTaskLib(e.tasks, taskId, patch);
        return tasks.ok ? ok({ ...e, tasks: tasks.value }) : tasks;
      }),
    deleteTask: (eventId, taskId) => {
      edit(eventId, (e) => ok({ ...e, tasks: deleteTaskLib(e.tasks, taskId) }));
    },
    delayTask: (eventId, taskId, days) => {
      const event = get().events[eventId];
      if (!event) return err("unknown_task");
      const impact = computeImpact(event, { kind: "delay", taskId, days });
      const [option] = generateOptions(event, impact);
      return option ? commitChange(eventId, impact, option) : err("unknown_task");
    },
  };
}

type VendorActions = Pick<
  Actions,
  "addVendor" | "updateVendor" | "removeVendor" | "addQuote" | "acceptQuote" | "unacceptQuote"
>;

export function vendorActions({ edit }: Kit): VendorActions {
  return {
    addVendor: (eventId, input) => {
      edit(eventId, (e) => ok({ ...e, vendors: addVendorLib(e.vendors, input) }));
    },
    updateVendor: (eventId, vendorId, patch) => {
      edit(eventId, (e) => {
        const vendors = updateVendorLib(e.vendors, vendorId, patch);
        return ok({ ...e, vendors, budget: syncCommitted(e.budget, vendors) });
      });
    },
    removeVendor: (eventId, vendorId) => {
      edit(eventId, (e) => ok(removeVendorLib(e, vendorId)));
    },
    addQuote: (eventId, vendorId, input) =>
      edit(eventId, (e) => {
        const vendors = addQuoteLib(e.vendors, vendorId, input);
        return vendors.ok ? ok({ ...e, vendors: vendors.value }) : vendors;
      }),
    acceptQuote: (eventId, vendorId, quoteId) =>
      edit(eventId, (e) => acceptQuoteLib(e, vendorId, quoteId)),
    unacceptQuote: (eventId, vendorId, quoteId) => {
      edit(eventId, (e) => ok(unacceptQuoteLib(e, vendorId, quoteId)));
    },
  };
}
