import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { axe } from "vitest-axe";
import App from "../../src/App";
import { BudgetBoard } from "../../src/components/budget/BudgetBoard";
import { ImpactSummary } from "../../src/components/change/ImpactSummary";
import { OptionCard } from "../../src/components/change/OptionCard";
import { BackupSection } from "../../src/components/home/BackupSection";
import { PlanFailed } from "../../src/components/intake/PlanFailed";
import { ChangeHistory } from "../../src/components/overview/ChangeHistory";
import { RunOfShow } from "../../src/components/overview/RunOfShow";
import { TodayCard } from "../../src/components/timeline/TodayCard";
import { ErrorBoundary } from "../../src/components/ui/ErrorBoundary";
import { Toaster } from "../../src/components/ui/Toast";
import { computeImpact } from "../../src/lib/impact";
import { MAX_IMPORT_BYTES } from "../../src/lib/io";
import { useEventStore } from "../../src/store/useEventStore";
import { event, line, task } from "../unit/fixtures";
import { resetStore } from "./render";
import type { RankedOption } from "../../src/lib/ranking";

/** Edge states that the main journeys do not reach: empty, over budget, failures, resets. */

describe("App shell", () => {
  it("renders the skip link, navigation and a lazy route, with no axe violations", async () => {
    resetStore();
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main",
    );
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "My events" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Your celebrations" }),
    ).toBeVisible();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("shows the not-found page for an unknown address", async () => {
    render(
      <MemoryRouter initialEntries={["/nowhere"]}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(/not found/i);
  });
});

describe("BudgetBoard states", () => {
  it("explains unassigned money", () => {
    render(
      <BudgetBoard event={event({ profile: { ...event().profile, totalBudget: 120_000 } })} />,
    );
    expect(screen.getByText(/is not assigned to a category yet/)).toBeInTheDocument();
    expect(screen.getByText("Within budget.")).toBeInTheDocument();
  });

  it("warns when categories exceed the total and a line is overspent", () => {
    const base = event();
    const budget = [
      line({ id: "food", category: "Catering", allocated: 90_000, spent: 95_000 }),
      line({ id: "venue", category: "Venue", allocated: 20_000 }),
    ];
    render(<BudgetBoard event={{ ...base, budget }} />);
    expect(screen.getByText(/Categories add up to .* more than the total/)).toBeInTheDocument();
    expect(screen.getByText(/Over budget: check the categories marked below/)).toBeInTheDocument();
  });
});

describe("ImpactSummary", () => {
  it("describes a surplus", () => {
    const e = event();
    render(
      <ImpactSummary event={e} impact={computeImpact(e, { kind: "budget", newTotal: 150_000 })} />,
    );
    expect(screen.getByText(/more than the plan needs/)).toBeInTheDocument();
  });

  it("says when no money moves and lists affected tasks", () => {
    const e = event();
    render(
      <ImpactSummary
        event={e}
        impact={computeImpact(e, { kind: "delay", taskId: "a", days: 2 })}
      />,
    );
    expect(screen.getByText("No money needs to move.")).toBeInTheDocument();
    expect(screen.getByText(/task\(s\) affected/)).toBeInTheDocument();
  });
});

describe("OptionCard", () => {
  const option: RankedOption = {
    id: "custom",
    label: "Cut catering a little",
    rank: 2,
    adjustments: [{ category: "Catering", delta: -5_000 }],
    budgetChange: 2_000,
    guestCountChange: -5,
    respectsTopPriority: false,
    aiSuggested: true,
  };

  it("flags a top-priority cut, the AI suggestion, and lists every change", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <ul>
        <OptionCard
          event={event()}
          option={option}
          newGuestCount={80}
          selected={false}
          ranked
          onSelect={onSelect}
        />
      </ul>,
    );
    expect(screen.getByText(/Cuts Food: no other option fits/)).toBeInTheDocument();
    expect(screen.getByText(/Suggested by AI, checked by Hostwise/)).toBeInTheDocument();
    expect(screen.getByText(/Total budget: \+/)).toBeInTheDocument();
    expect(screen.getByText("Guests: 75")).toBeInTheDocument();
    expect(screen.queryByText(/Recommended/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Preview this option" }));
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe("BackupSection", () => {
  it("rejects an import file over the size limit without touching saved events", () => {
    resetStore();
    render(<BackupSection events={[]} />);
    const input = screen.getByLabelText("Choose a Hostwise export file");
    const big = new File(["x"], "big.json", { type: "application/json" });
    Object.defineProperty(big, "size", { value: MAX_IMPORT_BYTES + 1 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(screen.getByRole("alert")).toHaveTextContent(/larger than 2 MB/);
    expect(useEventStore.getState().events).toEqual({});
  });
});

describe("PlanFailed", () => {
  it("retries the AI or falls back to the starter plan", async () => {
    const onBuild = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();
    const profile = event().profile;
    render(
      <PlanFailed message="The assistant is unavailable." profile={profile} onBuild={onBuild} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Your answers are kept.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await user.click(screen.getByRole("button", { name: "Use a starter plan instead" }));
    expect(onBuild.mock.calls).toEqual([[profile], [profile, true]]);
  });
});

describe("ChangeHistory", () => {
  it("undoes the last change and confirms it", async () => {
    resetStore();
    const user = userEvent.setup();
    useEventStore.getState().createEvent(event());
    useEventStore.getState().delayTask("e1", "a", 2);
    const current = useEventStore.getState().events.e1;
    if (!current) throw new Error("event saved");
    render(
      <MemoryRouter>
        <ChangeHistory event={current} />
        <Toaster />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /Undo last change/ }));
    expect(await screen.findByText("Last change undone.")).toBeInTheDocument();
    expect(useEventStore.getState().events.e1?.tasks[0]?.dueDate).toBe("2026-11-10");
  });
});

describe("RunOfShow and TodayCard", () => {
  it("lists booked vendors with their contact", () => {
    const e = event({
      vendors: [
        {
          id: "v1",
          name: "Annapurna",
          category: "Catering",
          contact: "98765 43210",
          status: "booked",
          quotes: [],
        },
      ],
    });
    render(<RunOfShow event={e} />);
    expect(screen.getByText("Annapurna (Catering): 98765 43210")).toBeInTheDocument();
  });

  it("marks overdue tasks in the Do next card", () => {
    const e = event({
      tasks: [task({ id: "late", title: "Send invites", dueDate: "2026-10-01" })],
    });
    render(<TodayCard event={e} today="2026-11-01" />);
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });
});

describe("ErrorBoundary", () => {
  it("recovers when the route changes", () => {
    let explode = true;
    const Maybe = () => {
      if (explode) throw new Error("boom");
      return <p>Recovered</p>;
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Maybe />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    explode = false;
    rerender(
      <ErrorBoundary resetKey="/b">
        <Maybe />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Recovered")).toBeInTheDocument();
    spy.mockRestore();
  });
});
