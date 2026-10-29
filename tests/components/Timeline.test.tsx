import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { TaskList } from "../../src/components/timeline/TaskList";
import { Toaster } from "../../src/components/ui/Toast";
import { useEventStore } from "../../src/store/useEventStore";
import { event } from "../unit/fixtures";
import { resetStore } from "./render";

const TODAY = "2026-11-12";

function Timeline() {
  const e = useEventStore((s) => s.events.e1);
  return e ? (
    <>
      <TaskList event={e} today={TODAY} />
      <Toaster />
    </>
  ) : null;
}

const item = (title: string) =>
  screen
    .getAllByRole("listitem")
    .find((li) => within(li).queryByRole("heading", { name: title })) as HTMLElement;

describe("Timeline tab", () => {
  beforeEach(() => {
    resetStore();
    useEventStore.getState().createEvent(event());
  });

  it("groups tasks by urgency with blocked reasons and no axe violations", async () => {
    const { container } = render(<Timeline />);
    expect(screen.getByRole("heading", { name: /Overdue/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Next 2 weeks/ })).toBeInTheDocument();
    expect(within(item("Book caterer")).getByText("Blocked by Book venue")).toBeInTheDocument();
    expect(within(item("Book venue")).getByText("Overdue")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("previews a vendor delay, applies it to dependents, flags at-risk tasks and can undo", async () => {
    const user = userEvent.setup();
    render(<Timeline />);
    await user.click(
      within(item("Book caterer")).getByRole("button", { name: "Delay Book caterer" }),
    );
    const dialog = screen.getByRole("dialog", { name: 'Delay "Book caterer"' });
    const days = within(dialog).getByLabelText(/how many days/);
    await user.clear(days);
    await user.type(days, "15");
    expect(within(dialog).getByText("2 tasks will move")).toBeInTheDocument();
    expect(within(dialog).getByText(/Confirm headcount: 2026-12-10 →/)).toBeInTheDocument();
    expect(within(dialog).getByText("After the event")).toBeInTheDocument();
    expect(await axe(document.body)).toHaveNoViolations();
    await user.click(within(dialog).getByRole("button", { name: "Apply delay" }));

    const tasks = useEventStore.getState().events.e1?.tasks ?? [];
    expect(tasks.map((t) => t.dueDate)).toEqual([
      "2026-11-10",
      "2026-12-05",
      "2026-12-25",
      "2026-12-15",
    ]);
    expect(
      within(item("Confirm headcount")).getByText("At risk: due after the event"),
    ).toBeInTheDocument();
    expect(within(item("Book caterer")).getByText("Delayed 15 days")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(useEventStore.getState().events.e1?.tasks[1]?.dueDate).toBe("2026-11-20");
  });

  it("rejects an invalid delay", async () => {
    const user = userEvent.setup();
    render(<Timeline />);
    await user.click(within(item("Book venue")).getByRole("button", { name: "Delay Book venue" }));
    const dialog = screen.getByRole("dialog");
    await user.clear(within(dialog).getByLabelText(/how many days/));
    await user.type(within(dialog).getByLabelText(/how many days/), "0");
    expect(within(dialog).getByRole("button", { name: "Apply delay" })).toBeDisabled();
    expect(within(dialog).getByText(/whole number from 1 to 120/)).toBeInTheDocument();
  });

  it("updates status and the Do next card follows", async () => {
    const user = userEvent.setup();
    render(<Timeline />);
    const todo = screen.getByRole("region", { name: "Do next" });
    expect(within(todo).getByText("Book venue")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Status for Book venue"), "done");
    expect(within(todo).queryByText("Book venue")).not.toBeInTheDocument();
    expect(within(todo).getByText("Book caterer")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Done/ })).toBeInTheDocument();
  });

  it("adds a custom task, rejects circular dependencies on edit, and deletes it", async () => {
    const user = userEvent.setup();
    render(<Timeline />);
    await user.click(screen.getByRole("button", { name: "Add a task" }));
    let dialog = screen.getByRole("dialog", { name: "Add a task" });
    await user.click(within(dialog).getByRole("button", { name: "Add task" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/Give the task a title/);
    await user.type(within(dialog).getByLabelText(/^Task/), "Order cake");
    await user.click(within(dialog).getByLabelText("Book caterer"));
    await user.click(within(dialog).getByRole("button", { name: "Add task" }));
    expect(within(item("Order cake")).getByText(/Added by you/)).toBeInTheDocument();

    // Book venue -> Book caterer -> Order cake: making venue wait for cake would loop.
    await user.click(within(item("Book venue")).getByRole("button", { name: "Edit Book venue" }));
    dialog = screen.getByRole("dialog", { name: "Edit task" });
    expect(within(dialog).queryByLabelText("Order cake")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await user.click(within(item("Order cake")).getByRole("button", { name: "Delete Order cake" }));
    expect(screen.queryByRole("heading", { name: "Order cake" })).not.toBeInTheDocument();
  });
});
