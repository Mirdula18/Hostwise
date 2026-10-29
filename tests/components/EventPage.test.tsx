import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { createSampleEvent } from "../../src/lib/sample";
import EventPage from "../../src/routes/EventPage";
import { useEventStore } from "../../src/store/useEventStore";
import { renderAt, resetStore } from "./render";

function setup(tab = "") {
  resetStore();
  const event = createSampleEvent("2026-11-01");
  useEventStore.getState().createEvent(event);
  const view = renderAt(<EventPage />, `/event/${event.id}${tab}`, "/event/:id");
  return { event, ...view };
}

describe("EventPage overview", () => {
  beforeEach(() => vi.setSystemTime(new Date("2026-11-01T10:00:00")));
  afterEach(() => vi.useRealTimers());

  it("shows the plan summary, assumptions and Do next card with no axe violations", async () => {
    const { container } = setup();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Mum & Dad's 35th");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "What I assumed" })).toBeInTheDocument();
    expect(screen.getByText(/wheelchair users need step-free entry/)).toBeInTheDocument();
    const glance = screen.getByRole("region", { name: "Budget at a glance" });
    expect(within(glance).getByText("Total budget").nextElementSibling).toHaveTextContent(
      "₹3,00,000",
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("updates the Do next card immediately when a task is completed", async () => {
    const user = userEvent.setup();
    setup();
    const card = screen.getByRole("region", { name: "Do next" });
    const first = within(card).getAllByRole("listitem")[0];
    expect(first).toHaveTextContent("Confirm date with parents");
    await user.click(within(card).getByRole("button", { name: /Mark "Confirm date with parents/ }));
    expect(within(card).queryByText(/Confirm date with parents/)).not.toBeInTheDocument();
    expect(within(card).getAllByRole("listitem")[0]).toHaveTextContent(
      /Draft the guest list|Shortlist/,
    );
  });

  it("switches tabs with the keyboard and keeps the tab in the URL", async () => {
    const user = userEvent.setup();
    setup("?tab=budget");
    expect(screen.getByRole("tab", { name: "Budget" })).toHaveAttribute("aria-selected", "true");
    screen.getByRole("tab", { name: "Budget" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Timeline" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows not found for an unknown event", () => {
    resetStore();
    renderAt(<EventPage />, "/event/nope", "/event/:id");
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});
