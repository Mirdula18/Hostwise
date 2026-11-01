import { z } from "zod";
import { Event } from "../schemas/event";

export const STORE_VERSION = 1;
export const STORE_KEY = "hostwise:v1";

export type PersistedState = { events: Record<string, Event>; activeId: string | null };

const EMPTY: PersistedState = { events: {}, activeId: null };

/** The outer shape of stored state; each event is validated on its own below. */
const Persisted = z.object({
  events: z.record(z.string(), z.unknown()).optional().catch(undefined),
  activeId: z.unknown().optional(),
});

/**
 * Turns whatever is in localStorage into a valid state. Events that fail validation
 * are dropped rather than crashing the app; unknown versions start fresh.
 */
export function migrate(persisted: unknown, version: number): PersistedState {
  const raw = Persisted.safeParse(persisted);
  if (version !== STORE_VERSION || !raw.success) return EMPTY;
  const events: Record<string, Event> = {};
  for (const value of Object.values(raw.data.events ?? {})) {
    const parsed = Event.safeParse(value);
    if (parsed.success) events[parsed.data.id] = parsed.data;
  }
  const { activeId } = raw.data;
  return { events, activeId: typeof activeId === "string" && activeId in events ? activeId : null };
}
