import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { BudgetBoard } from "../../src/components/budget/BudgetBoard";
import { CategoryCard } from "../../src/components/budget/CategoryCard";
import { useEventStore } from "../../src/store/useEventStore";
import { event, line } from "../unit/fixtures";
import { resetStore } from "./render";

function Board() {
  const e = useEventStore((s) => s.events.e1);
  return e ? <BudgetBoard event={e} /> : null;
}

const card = (name: string) => screen.getByRole("listitem", { name });

describe("Budget tab", () => {
  beforeEach(() => {
    resetStore();
    useEventStore.getState().createEvent(event());
  });

  it("renders category cards with source badges and no axe violations", async () => {
    const { container } = render(<Board />);
    expect(
      within(screen.getByRole("list", { name: "Categories" })).getAllByRole("listitem"),
    ).toHaveLength(5);
    expect(
      within(card("Catering")).getByRole("button", { name: "Estimate" }),
    ).toHaveAccessibleDescription(/not a vendor price/);
    expect(within(card("Catering")).getByText("₹0 of ₹400 used, 0%")).toBeInTheDocument();
    expect(screen.getByText("Within budget.")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("shows 'Over by …' in text, not only colour, when committed exceeds allocated", async () => {
    const { container } = render(
      <ul>
        <CategoryCard
          eventId="e1"
          currency="INR"
          isPriority={false}
          line={line({
            id: "x",
            category: "Venue",
            allocated: 10_000,
            committed: 12_500,
            source: "quote",
          })}
        />
      </ul>,
    );
    expect(screen.getByText("Over by ₹25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vendor quote" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("raises a category and rebalances the lowest priorities first", async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(within(card("Catering")).getByRole("button", { name: "Edit Catering" }));
    const dialog = screen.getByRole("dialog", { name: "Edit Catering" });
    const amount = within(dialog).getByLabelText(/Amount for Catering/);
    await user.clear(amount);
    await user.type(amount, "500");
    expect(within(dialog).getByLabelText("Rebalance others by priority")).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    const budget = useEventStore.getState().events.e1?.budget ?? [];
    expect(budget.find((l) => l.id === "food")).toMatchObject({
      allocated: 50_000,
      source: "user",
    });
    expect(budget.find((l) => l.id === "decor")?.allocated).toBe(5_000);
    expect(useEventStore.getState().events.e1?.profile.totalBudget).toBe(100_000);
    expect(
      within(card("Catering")).getByRole("button", { name: "Your number" }),
    ).toBeInTheDocument();
  });

  it("can change the total instead, and record spending", async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(within(card("Decor")).getByRole("button", { name: "Edit Decor" }));
    const dialog = screen.getByRole("dialog");
    await user.clear(within(dialog).getByLabelText(/Amount for Decor/));
    await user.type(within(dialog).getByLabelText(/Amount for Decor/), "200");
    await user.click(within(dialog).getByLabelText("Keep others; change total"));
    await user.clear(within(dialog).getByLabelText(/Spent so far/));
    await user.type(within(dialog).getByLabelText(/Spent so far/), "50");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(useEventStore.getState().events.e1?.profile.totalBudget).toBe(105_000);
    expect(useEventStore.getState().events.e1?.budget.find((l) => l.id === "decor")?.spent).toBe(
      5_000,
    );
  });

  it("explains why a rebalance is impossible when everything else is locked", async () => {
    const user = userEvent.setup();
    for (const id of ["venue", "comfort", "decor", "favours"])
      useEventStore.getState().lockLine("e1", id);
    render(<Board />);
    expect(within(card("Venue")).getByRole("button", { name: "Lock Venue" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(card("Catering")).getByRole("button", { name: "Edit Catering" }));
    const dialog = screen.getByRole("dialog");
    await user.clear(within(dialog).getByLabelText(/Amount for Catering/));
    await user.type(within(dialog).getByLabelText(/Amount for Catering/), "450");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/₹50 short/);
    await user.type(within(dialog).getByLabelText(/Amount for Catering/), "x");
    await user.clear(within(dialog).getByLabelText(/Amount for Catering/));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/as numbers/);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("toggles a lock from the card", async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(within(card("Venue")).getByRole("button", { name: "Lock Venue" }));
    expect(within(card("Venue")).getByText("Locked")).toBeInTheDocument();
  });
});
