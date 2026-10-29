import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import Home from "../../src/routes/Home";
import { useEventStore } from "../../src/store/useEventStore";
import { event } from "../unit/fixtures";
import { renderAt, resetStore } from "./render";

describe("Home", () => {
  beforeEach(resetStore);

  it("shows the empty state with no axe violations", async () => {
    const { container } = renderAt(<Home />, "/", "/");
    expect(
      screen.getByRole("heading", { level: 1, name: "Your celebrations" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No events yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export all events/ })).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("creates the sample event and navigates to it", async () => {
    const user = userEvent.setup();
    renderAt(<Home />, "/", "/");
    await user.click(screen.getByRole("button", { name: "Use sample event" }));
    expect(Object.values(useEventStore.getState().events)).toHaveLength(1);
    expect(screen.getByText("Navigated away")).toBeInTheDocument();
  });

  it("lists saved events and deletes one after confirming", async () => {
    const user = userEvent.setup();
    useEventStore.getState().createEvent(event());
    const { container } = renderAt(<Home />, "/", "/");
    expect(screen.getByRole("link", { name: "Test" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole("button", { name: "Delete Test" }));
    expect(screen.getByRole("dialog", { name: "Delete this event?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(useEventStore.getState().events.e1).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Delete Test" }));
    await user.click(screen.getByRole("button", { name: "Delete event" }));
    expect(useEventStore.getState().events.e1).toBeUndefined();
  });

  it("shows an alert for a malformed import and leaves events unchanged", async () => {
    useEventStore.getState().createEvent(event());
    renderAt(<Home />, "/", "/");
    const input = screen.getByLabelText("Choose a Hostwise export file");
    const file = new File(["{oops"], "bad.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/not valid JSON/));
    expect(Object.keys(useEventStore.getState().events)).toEqual(["e1"]);
  });

  it("imports a valid export", async () => {
    renderAt(<Home />, "/", "/");
    const text = JSON.stringify({ version: 1, events: [event()] });
    const input = screen.getByLabelText("Choose a Hostwise export file");
    fireEvent.change(input, { target: { files: [new File([text], "ok.json")] } });
    await waitFor(() => expect(useEventStore.getState().events.e1).toBeDefined());
  });
});
