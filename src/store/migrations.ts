import { Event } from "../schemas/event";

export const STORE_VERSION = 1;
export const STORE_KEY = "hostwise:v1";

export type PersistedState = { events: Record<string, Event>; activeId: string | null };

const EMPTY: PersistedState = { events: {}, activeId: null };

/**
 * Turns whatever is in localStorage into a valid state. Events that fail validation
 * are dropped rather than crashing the app; unknown versions start fresh.
 */
export function migrate(persisted: unknown, version: number): PersistedState {
  if (version !== STORE_VERSION || typeof persisted !== "object" || persisted === null) {
    return EMPTY;
  }
  const raw = persisted as { events?: unknown; activeId?: unknown };
  const events: Record<string, Event> = {};
  if (raw.events && typeof raw.events === "object") {
    for (const value of Object.values(raw.events as Record<string, unknown>)) {
      const parsed = Event.safeParse(value);
      if (parsed.success) events[parsed.data.id] = parsed.data;
    }
  }
  const activeId = typeof raw.activeId === "string" && raw.activeId in events ? raw.activeId : null;
  return { events, activeId };
}
