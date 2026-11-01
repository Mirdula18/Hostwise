import { create, type StoreApi } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { migrate, STORE_KEY, STORE_VERSION, type PersistedState } from "./migrations";
import { rebalance, setLineAmount, setSpent, toggleLock, type RebalanceError } from "../lib/budget";
import { applyOption, computeImpact, generateOptions, type ApplyError } from "../lib/change";
import { importEvents as parseImport } from "../lib/io";
import { err, ok, type Result } from "../lib/result";
import {
  addTask as addTaskLib,
  deleteTask as deleteTaskLib,
  updateTask as updateTaskLib,
  type TaskEditError,
  type TaskInput,
} from "../lib/timeline";
import {
  acceptQuote as acceptQuoteLib,
  addQuote as addQuoteLib,
  addVendor as addVendorLib,
  removeVendor as removeVendorLib,
  syncCommitted,
  unacceptQuote as unacceptQuoteLib,
  updateVendor as updateVendorLib,
  type QuoteInput,
  type VendorError,
  type VendorInput,
} from "../lib/vendors";
import type { Event, Impact, TradeOffOption, Vendor } from "../schemas/event";

export const UNDO_LIMIT = 20;

export type EditMode = "rebalance" | "changeTotal";

type State = PersistedState & {
  /** Undo snapshots per event, newest last. Session-only (not persisted). */
  history: Record<string, Event[]>;
};

type Actions = {
  createEvent: (event: Event) => string;
  setActive: (id: string | null) => void;
  deleteEvent: (id: string) => void;
  updateBudgetLine: (
    eventId: string,
    lineId: string,
    amount: number,
    mode: EditMode,
  ) => Result<void, RebalanceError>;
  lockLine: (eventId: string, lineId: string) => void;
  setLineSpent: (eventId: string, lineId: string, spent: number) => Result<void, "negative">;
  addTask: (eventId: string, input: TaskInput) => Result<void, TaskEditError>;
  updateTask: (
    eventId: string,
    taskId: string,
    patch: Partial<TaskInput>,
  ) => Result<void, TaskEditError>;
  deleteTask: (eventId: string, taskId: string) => void;
  delayTask: (eventId: string, taskId: string, days: number) => Result<void, ApplyError>;
  addVendor: (eventId: string, input: VendorInput) => void;
  updateVendor: (
    eventId: string,
    vendorId: string,
    patch: Partial<Omit<Vendor, "id" | "quotes">>,
  ) => void;
  removeVendor: (eventId: string, vendorId: string) => void;
  addQuote: (
    eventId: string,
    vendorId: string,
    input: QuoteInput,
  ) => Result<void, "vendor_not_found" | "invalid_amount">;
  acceptQuote: (eventId: string, vendorId: string, quoteId: string) => Result<void, VendorError>;
  unacceptQuote: (eventId: string, vendorId: string, quoteId: string) => void;
  applyChange: (
    eventId: string,
    impact: Impact,
    option: TradeOffOption,
  ) => Result<void, ApplyError>;
  undo: (eventId: string) => boolean;
  importEvents: (text: string) => Result<number>;
};

type EventStore = State & Actions;

const now = () => new Date().toISOString();

const without = <V>(record: Record<string, V>, key: string): Record<string, V> =>
  Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

type Set = StoreApi<EventStore>["setState"];
type Get = StoreApi<EventStore>["getState"];

/** Shared write helpers handed to each slice of actions. */
type Kit = {
  set: Set;
  get: Get;
  edit: <E>(eventId: string, fn: (e: Event) => Result<Event, E>) => Result<void, E>;
  commitChange: (
    eventId: string,
    impact: Impact,
    option: TradeOffOption,
  ) => Result<void, ApplyError>;
};

function makeKit(set: Set, get: Get): Kit {
  /** Replaces one event with `next`, stamping updatedAt. */
  const put = (next: Event) =>
    set((s) => ({ events: { ...s.events, [next.id]: { ...next, updatedAt: now() } } }));

  /** Runs a pure update on an event; a missing event is a no-op. */
  const edit: Kit["edit"] = (eventId, fn) => {
    const event = get().events[eventId];
    if (!event) return ok(undefined);
    const r = fn(event);
    if (!r.ok) return r;
    put(r.value);
    return ok(undefined);
  };

  /** Applies an option atomically and saves the previous state for undo. */
  const commitChange: Kit["commitChange"] = (eventId, impact, option) => {
    const before = get().events[eventId];
    if (!before) return err("unbalanced");
    const r = applyOption(before, impact, option, now());
    if (!r.ok) return r;
    set((s) => ({
      events: { ...s.events, [eventId]: r.value },
      history: {
        ...s.history,
        [eventId]: [...(s.history[eventId] ?? []), before].slice(-UNDO_LIMIT),
      },
    }));
    return ok(undefined);
  };
  return { set, get, edit, commitChange };
}

type EventActions = Pick<
  Actions,
  "createEvent" | "setActive" | "deleteEvent" | "applyChange" | "undo" | "importEvents"
>;

function eventActions({ set, get, commitChange }: Kit): EventActions {
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

function budgetActions({ edit }: Kit): BudgetActions {
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

function taskActions({ get, edit, commitChange }: Kit): TaskActions {
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

function vendorActions({ edit }: Kit): VendorActions {
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

export const useEventStore = create<EventStore>()(
  persist(
    (set, get) => {
      const kit = makeKit(set, get);
      return {
        events: {},
        activeId: null,
        history: {},
        ...eventActions(kit),
        ...budgetActions(kit),
        ...taskActions(kit),
        ...vendorActions(kit),
      };
    },
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): PersistedState => ({ events: s.events, activeId: s.activeId }),
      migrate: (persisted, version) => migrate(persisted, version),
      merge: (persisted, current) => ({ ...current, ...migrate(persisted, STORE_VERSION) }),
    },
  ),
);

/** Stable selectors: components subscribe to the smallest slice they need. */
export const useEvent = (id: string | undefined) =>
  useEventStore((s) => (id ? s.events[id] : undefined));

export const useEventList = () =>
  useEventStore(
    useShallow((s) =>
      Object.values(s.events).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    ),
  );

export const useCanUndo = (id: string) => useEventStore((s) => (s.history[id]?.length ?? 0) > 0);
