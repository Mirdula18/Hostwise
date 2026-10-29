import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useEventStore } from "../../src/store/useEventStore";

export function resetStore() {
  useEventStore.setState({ events: {}, activeId: null, history: {} });
}

/** Renders `ui` at `path` inside a router; `pattern` is the route it is mounted on. */
export function renderAt(ui: ReactElement, path = "/", pattern = "*") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={ui} />
        <Route path="*" element={<p>Navigated away</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
