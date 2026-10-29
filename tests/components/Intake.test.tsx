import { screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { SAMPLE_PLAN } from "../../src/lib/sample";
import Intake from "../../src/routes/Intake";
import { useEventStore } from "../../src/store/useEventStore";
import { mockAI } from "./aiMock";
import { renderAt, resetStore } from "./render";

const heading = () => screen.findByRole("heading", { level: 2, name: /.+/, hidden: false });

async function answerRequired(user: UserEvent) {
  await screen.findByRole("heading", { name: "What are you celebrating?" });
  await user.selectOptions(screen.getByLabelText(/Occasion/), "anniversary");
  await user.click(screen.getByRole("button", { name: "Next" }));

  await screen.findByRole("heading", { name: "When is the celebration?" });
  await user.type(screen.getByLabelText(/Event date/), "2026-12-20");
  await user.click(screen.getByRole("button", { name: "Next" }));

  await screen.findByRole("heading", { name: /how many guests/ });
  await user.type(screen.getByLabelText(/Number of guests/), "60");
  await user.click(screen.getByRole("button", { name: "Next" }));

  await screen.findByRole("heading", { name: /total budget/ });
  await user.type(screen.getByLabelText(/Total budget/), "300000");
  await user.click(screen.getByRole("button", { name: "Next" }));

  await screen.findByRole("heading", { name: /currency/ });
  await user.selectOptions(screen.getByLabelText(/Currency/), "INR");
  await user.click(screen.getByRole("button", { name: "Next" }));

  await screen.findByRole("heading", { name: /Rank what matters/ });
  // Default order is food, venue, décor, entertainment, photography, guest comfort, …
  for (let i = 0; i < 3; i++) {
    await user.click(screen.getByRole("button", { name: "Move Guest comfort up" }));
  }
  await user.click(screen.getByRole("button", { name: "Next" }));
}

describe("Intake", () => {
  beforeEach(() => {
    resetStore();
    vi.setSystemTime(new Date("2026-11-01T10:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses the static questions when AI is down, validates input, and builds a starter plan", async () => {
    const user = userEvent.setup();
    const { calls } = mockAI({});
    const { container } = renderAt(<Intake />, "/intake", "/intake");
    await screen.findByText(/assistant isn't reachable/);
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose what you're celebrating.");

    await answerRequired(user);
    // Optional anniversary follow-ups can be skipped.
    for (let i = 0; i < 4; i++) {
      await screen.findByRole("button", { name: "Skip / not sure" });
      await user.click(screen.getByRole("button", { name: "Skip / not sure" }));
    }
    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent(/Your answers are kept/);
    expect(calls.filter((c) => c.task === "intake_next")).toHaveLength(1);
    expect(calls.filter((c) => c.task === "plan")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Use a starter plan instead" }));
    await screen.findByText("Navigated away");
    const [event] = Object.values(useEventStore.getState().events);
    expect(event?.profile).toMatchObject({
      occasion: "anniversary",
      guestCount: 60,
      totalBudget: 30_000_000,
      priorities: ["food", "venue", "guest_comfort"],
    });
  });

  it("asks AI-chosen questions, rejects bad answers, and creates the AI plan", async () => {
    const user = userEvent.setup();
    const order = ["occasion", "date", "guestCount", "totalBudget", "currency", "priorities"];
    const { calls } = mockAI({
      intake_next: (input) => {
        const asked = input.asked as string[];
        const field = order[asked.length];
        if (field) return { done: false, field, question: `Q:${field}`, inputType: "text" };
        if (!asked.includes("accessibility")) {
          return {
            done: false,
            field: "accessibility",
            question: "Will any of your senior guests need step-free access?",
            inputType: "text",
          };
        }
        return { done: true };
      },
      plan: () => SAMPLE_PLAN,
    });
    renderAt(<Intake />, "/intake", "/intake");

    await screen.findByRole("heading", { name: "Q:occasion" });
    await user.selectOptions(screen.getByLabelText(/Occasion/), "anniversary");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Q:date" });
    await user.type(screen.getByLabelText(/Event date/), "2026-10-01");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a date after today.");
    expect(screen.getByLabelText(/Event date/)).toHaveAttribute("aria-invalid", "true");
    await user.clear(screen.getByLabelText(/Event date/));
    await user.type(screen.getByLabelText(/Event date/), "2026-12-20");
    await user.click(screen.getByRole("button", { name: "Next" }));

    await screen.findByRole("heading", { name: "Q:guestCount" });
    await user.type(screen.getByLabelText(/Number of guests/), "1001");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/between 1 and 1000/);

    // Back re-opens the previous answer, pre-filled.
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByLabelText(/Event date/)).toHaveValue("2026-12-20");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Q:guestCount" });
    await user.type(screen.getByLabelText(/Number of guests/), "60");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Q:totalBudget" });
    await user.type(screen.getByLabelText(/Total budget/), "300000");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Q:currency" });
    await user.selectOptions(screen.getByLabelText(/Currency/), "INR");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "Q:priorities" });
    await user.click(screen.getByRole("button", { name: "Next" }));

    await screen.findByRole("heading", { name: /senior guests need step-free/ });
    await user.type(screen.getByLabelText(/Accessibility needs/), "Two wheelchair users");
    await user.click(screen.getByRole("button", { name: "Next" }));

    await screen.findByText("Navigated away");
    const [event] = Object.values(useEventStore.getState().events);
    expect(event?.profile.accessibility).toBe("Two wheelchair users");
    expect(event?.profile.title).toBe("Anniversary on 2026-12-20");
    expect(event?.budget.reduce((s, l) => s + l.allocated, 0)).toBe(30_000_000);
    const planCall = calls.find((c) => c.task === "plan");
    expect(planCall?.input).toMatchObject({ guestCount: 60, currency: "INR" });
  });

  it("lets the host change an earlier answer from the answers list", async () => {
    const user = userEvent.setup();
    mockAI({});
    renderAt(<Intake />, "/intake", "/intake");
    await screen.findByRole("heading", { name: "What are you celebrating?" });
    await user.selectOptions(screen.getByLabelText(/Occasion/), "kids_birthday");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("heading", { name: "When is the celebration?" });
    expect(screen.getByText("Kid's birthday")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Change answer: What are you celebrating/ }),
    );
    expect(await screen.findByLabelText(/Occasion/)).toHaveValue("kids_birthday");
    expect((await heading()).textContent).toBe("What are you celebrating?");
  });

  it("shows an alert with Try again when the plan call returns invalid data twice", async () => {
    const user = userEvent.setup();
    mockAI({ plan: "invalid" });
    renderAt(<Intake />, "/intake", "/intake");
    await answerRequired(user);
    for (let i = 0; i < 4; i++) {
      await user.click(await screen.findByRole("button", { name: "Skip / not sure" }));
    }
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/didn't make sense/);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    await waitFor(() => expect(useEventStore.getState().events).toEqual({}));
  });
});
