import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { axe } from "vitest-axe";
import { Toaster } from "../../src/components/ui/Toast";
import Change from "../../src/routes/Change";
import EventPage from "../../src/routes/EventPage";
import { useEventStore } from "../../src/store/useEventStore";
import { event } from "../unit/fixtures";
import { mockAI } from "./aiMock";
import { resetStore } from "./render";

function renderChange() {
  return render(
    <MemoryRouter initialEntries={["/event/e1/change"]}>
      <Routes>
        <Route path="/event/:id" element={<EventPage />} />
        <Route path="/event/:id/change" element={<Change />} />
      </Routes>
      <Toaster />
    </MemoryRouter>,
  );
}

const allocated = (id: string) =>
  useEventStore.getState().events.e1?.budget.find((l) => l.id === id)?.allocated;

describe("Change flow", () => {
  beforeEach(() => {
    resetStore();
    useEventStore.getState().createEvent(event());
    vi.setSystemTime(new Date("2026-11-01T10:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('"add 20 guests": options render, Apply updates the budget, Undo restores it', async () => {
    const user = userEvent.setup();
    const { calls } = mockAI({
      parse_change: (input) => ({ kind: "guests", newCount: (input.guestCount as number) + 20 }),
      rank_options: () => ({
        ranking: [
          {
            optionId: "protect",
            why: "Food is your top priority, so Catering grows with the guest list while Decor gives way.",
            whatTheyGiveUp: "Simpler decorations.",
          },
          { optionId: "raise-budget", why: "Nothing is cut.", whatTheyGiveUp: "You spend more." },
        ],
      }),
    });
    const { container } = renderChange();
    expect(screen.getByRole("heading", { level: 1, name: "What changed?" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    await user.type(screen.getByLabelText("What changed?"), "add 20 guests");
    await user.click(screen.getByRole("button", { name: "Work out the impact" }));

    const options = await screen.findByRole("region", { name: "Your options" });
    expect(screen.getByText(/shortfall of/)).toHaveTextContent("shortfall of ₹199.99");
    expect(screen.getByText(/1\. Food, 2\. Guest comfort, 3\. Venue/)).toBeInTheDocument();
    const cards = within(options).getAllByRole("listitem");
    expect(cards[0]).toHaveTextContent("#1 · Recommended");
    expect(cards[0]).toHaveTextContent(/Food is your top priority/);
    expect(cards[0]).toHaveTextContent("Protects Food");
    expect(calls.map((c) => c.task)).toEqual(["parse_change", "rank_options"]);
    expect(calls[0]?.input).toMatchObject({ text: "add 20 guests", guestCount: 60 });
    expect(await axe(container)).toHaveNoViolations();

    await user.click(
      within(cards[0] as HTMLElement).getByRole("button", { name: "Preview this option" }),
    );
    const preview = screen.getByRole("region", { name: /Preview: Protect Food/ });
    const table = within(preview).getByRole("table", { name: "Budget before and after" });
    expect(within(table).getByRole("row", { name: /Catering/ })).toHaveTextContent(
      "₹400₹533.33+₹133.33",
    );
    expect(within(preview).getByText(/Guests: 60 →/)).toHaveTextContent("Guests: 60 → 80");

    const before = structuredClone(useEventStore.getState().events.e1);
    await user.click(within(preview).getByRole("button", { name: "Apply this change" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Test" })).toBeInTheDocument();
    expect(useEventStore.getState().events.e1?.profile.guestCount).toBe(80);
    expect(allocated("food")).toBe(53_333);
    expect(allocated("decor")).toBe(0);
    expect(screen.getByText(/Guests 60 → 80: Protect Food/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(useEventStore.getState().events.e1).toEqual(before);
  });

  it("works without AI using the quick forms, listing options unranked", async () => {
    const user = userEvent.setup();
    mockAI({});
    renderChange();
    await user.click(screen.getByRole("button", { name: "Budget change" }));
    expect(screen.getByRole("button", { name: "Budget change" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await user.type(screen.getByLabelText(/New total budget/), "800");
    await user.click(screen.getByRole("button", { name: "See options" }));

    const options = await screen.findByRole("region", { name: "Your options" });
    expect(screen.getByText(/couldn't rank these right now/)).toBeInTheDocument();
    expect(within(options).getAllByRole("listitem")[0]).not.toHaveTextContent("Recommended");
    await user.click(
      within(options).getAllByRole("button", { name: "Preview this option" })[0] as HTMLElement,
    );
    await user.click(screen.getByRole("button", { name: "Apply this change" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Test" })).toBeInTheDocument();
    expect(useEventStore.getState().events.e1?.profile.totalBudget).toBe(80_000);
    expect(allocated("food")).toBe(40_000);
  });

  it("fills the text box from an example chip", async () => {
    const user = userEvent.setup();
    renderChange();
    await user.click(
      screen.getByRole("button", { name: "Use example: 15 more guests are coming" }),
    );
    expect(screen.getByLabelText("What changed?")).toHaveValue("15 more guests are coming");
  });

  it("asks the clarifying question when the change is unclear", async () => {
    const user = userEvent.setup();
    mockAI({
      parse_change: () => ({ kind: "unclear", clarifyingQuestion: "More guests or fewer?" }),
    });
    renderChange();
    await user.type(screen.getByLabelText("What changed?"), "change the guests");
    await user.click(screen.getByRole("button", { name: "Work out the impact" }));
    expect(await screen.findByText("More guests or fewer?")).toBeInTheDocument();
  });

  it("shows an alert with Try again when the AI cannot read the change", async () => {
    const user = userEvent.setup();
    mockAI({ parse_change: "fail" });
    renderChange();
    await user.click(screen.getByRole("button", { name: "Work out the impact" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Describe what changed/);
    await user.type(screen.getByLabelText("What changed?"), "something");
    await user.click(screen.getByRole("button", { name: "Work out the impact" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/quick buttons/);
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("previews a vendor delay with moved tasks and the at-risk flag", async () => {
    const user = userEvent.setup();
    mockAI({});
    renderChange();
    await user.click(screen.getByRole("button", { name: "Vendor delay" }));
    await user.selectOptions(screen.getByLabelText(/Which task is delayed/), "Book caterer");
    await user.type(screen.getByLabelText(/Delay in days/), "15");
    await user.click(screen.getByRole("button", { name: "See options" }));
    const preview = await screen.findByRole("region", { name: /Preview: Apply the change/ });
    expect(within(preview).getByText(/Confirm headcount: 2026-12-10 →/)).toBeInTheDocument();
    expect(within(preview).getByText("After the event")).toBeInTheDocument();
    await user.click(within(preview).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("region", { name: /Preview/ })).not.toBeInTheDocument();
  });

  it("rejects quick-form input that is out of range or not a real change", async () => {
    const user = userEvent.setup();
    mockAI({});
    renderChange();
    await user.click(screen.getByRole("button", { name: "Guest change" }));
    await user.type(screen.getByLabelText(/New guest count/), "0");
    await user.click(screen.getByRole("button", { name: "See options" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/between 1 and 1000/);
    await user.clear(screen.getByLabelText(/New guest count/));
    await user.type(screen.getByLabelText(/New guest count/), "60");
    await user.click(screen.getByRole("button", { name: "See options" }));
    expect(await screen.findByText("You already have 60 guests planned.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Date change" }));
    await user.click(screen.getByRole("button", { name: "See options" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose the new date.");
    await user.click(screen.getByRole("button", { name: "Vendor delay" }));
    await user.click(screen.getByRole("button", { name: "See options" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/between 1 and 120/);
    await user.click(screen.getByRole("button", { name: "Budget change" }));
    await user.click(screen.getByRole("button", { name: "See options" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/above 0/);
  });
});
