import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { makeKit, type EventStore } from "./kit";
import { migrate, STORE_KEY, STORE_VERSION, type PersistedState } from "./migrations";
import { budgetActions, eventActions, taskActions, vendorActions } from "./slices";

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
