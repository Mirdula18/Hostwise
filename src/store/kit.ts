/** Store types and the shared write helpers (save, edit, commit with undo). */
import { type RebalanceError } from "../lib/budget";
import { applyOption, type ApplyError } from "../lib/change";
import { err, ok, type Result } from "../lib/result";
import { type TaskEditError, type TaskInput } from "../lib/taskEdit";
import { type QuoteInput, type VendorError, type VendorInput } from "../lib/vendors";
import type { PersistedState } from "./migrations";
import type { Event, Impact, TradeOffOption, Vendor } from "../schemas/event";
import type { StoreApi } from "zustand";

/** Undo snapshots kept per event (session only). */
export const UNDO_LIMIT = 20;

/** Rebalance keeps the total; changeTotal lets the total follow the edited line. */
export type EditMode = "rebalance" | "changeTotal";

/** Persisted events plus session-only undo snapshots. */
export type State = PersistedState & {
  /** Undo snapshots per event, newest last. Session-only (not persisted). */
  history: Record<string, Event[]>;
};

/** Every action the store exposes to components. */
export type Actions = {
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

/** The full store: persisted events plus session-only undo history, and every action. */
export type EventStore = State & Actions;

/** The current time as an ISO string, for change logs and updatedAt. */
const now = () => new Date().toISOString();

/** A copy of `record` without `key`. */
export const without = <V>(record: Record<string, V>, key: string): Record<string, V> =>
  Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

type Set = StoreApi<EventStore>["setState"];
type Get = StoreApi<EventStore>["getState"];

/** Shared write helpers handed to each slice of actions. */
export type Kit = {
  set: Set;
  get: Get;
  edit: <E>(eventId: string, fn: (e: Event) => Result<Event, E>) => Result<void, E>;
  commitChange: (
    eventId: string,
    impact: Impact,
    option: TradeOffOption,
  ) => Result<void, ApplyError>;
};

/** Builds the shared write helpers for the action slices. */
export function makeKit(set: Set, get: Get): Kit {
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
