import type { BudgetLine, Event, Task } from "../../src/schemas/event";

export function line(over: Partial<BudgetLine> & Pick<BudgetLine, "id">): BudgetLine {
  return {
    category: over.id,
    allocated: 0,
    committed: 0,
    spent: 0,
    perGuest: false,
    locked: false,
    source: "estimate",
    ...over,
  };
}

export function task(over: Partial<Task> & Pick<Task, "id">): Task {
  return {
    title: `Task ${over.id}`,
    category: "Planning",
    dueDate: "2026-12-01",
    status: "todo",
    dependsOn: [],
    custom: false,
    delayDays: 0,
    ...over,
  };
}

/** 60 guests, total 100,000 (minor), priorities food > guest_comfort > venue. */
export function event(over: Partial<Event> = {}): Event {
  return {
    id: "e1",
    profile: {
      occasion: "anniversary",
      title: "Test",
      date: "2026-12-20",
      guestCount: 60,
      totalBudget: 100_000,
      currency: "INR",
      priorities: ["food", "guest_comfort", "venue"],
    },
    budget: [
      line({
        id: "food",
        category: "Catering",
        priorityTag: "food",
        allocated: 40_000,
        perGuest: true,
      }),
      line({ id: "venue", category: "Venue", priorityTag: "venue", allocated: 25_000 }),
      line({
        id: "comfort",
        category: "Comfort",
        priorityTag: "guest_comfort",
        allocated: 10_000,
        perGuest: true,
      }),
      line({ id: "decor", category: "Decor", priorityTag: "decor", allocated: 15_000 }),
      line({
        id: "favours",
        category: "Favours",
        priorityTag: "favours",
        allocated: 10_000,
        perGuest: true,
      }),
    ],
    tasks: [
      task({ id: "a", title: "Book venue", dueDate: "2026-11-10" }),
      task({ id: "b", title: "Book caterer", dueDate: "2026-11-20", dependsOn: ["a"] }),
      task({ id: "c", title: "Confirm headcount", dueDate: "2026-12-10", dependsOn: ["b"] }),
      task({ id: "d", title: "Buy flowers", dueDate: "2026-12-15" }),
    ],
    vendors: [],
    assumptions: [],
    changeLog: [],
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...over,
  };
}

export const allocatedSum = (lines: readonly BudgetLine[]) =>
  lines.reduce((a, l) => a + l.allocated, 0);
