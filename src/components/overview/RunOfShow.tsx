import { useMemo } from "react";
import { lineStatus } from "../../lib/budgetStatus";
import { displayAnswer } from "../../lib/intake";
import { format } from "../../lib/money";
import { topoSort } from "../../lib/taskGraph";
import type { Event } from "../../schemas/event";

const STATUS = { todo: "To do", doing: "Doing", done: "Done" } as const;

/** Print-only summary: key details, every task in order, the budget and booked vendors. */
export function RunOfShow({ event }: { event: Event }) {
  const { profile } = event;
  const money = (n: number) => format(n, profile.currency);
  const tasks = useMemo(
    () => [...topoSort(event.tasks)].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [event.tasks],
  );
  const booked = event.vendors.filter((v) => v.status === "booked");

  return (
    <section aria-label="Run of show" className="hidden space-y-4 text-black print:block">
      <h2 className="text-xl font-bold">Run of show</h2>
      <p>
        {profile.date} · {profile.guestCount} guests · Budget {money(profile.totalBudget)}
        {profile.city ? ` · ${profile.city}` : ""}
      </p>
      <p>Priorities: {displayAnswer("priorities", profile)}</p>
      {profile.accessibility ? <p>Accessibility: {profile.accessibility}</p> : null}
      {profile.dietary ? <p>Dietary: {profile.dietary}</p> : null}

      <table className="w-full border-collapse text-sm">
        <caption className="text-left font-semibold">Tasks</caption>
        <thead>
          <tr>
            <th scope="col" className="border p-1 text-left">
              Due
            </th>
            <th scope="col" className="border p-1 text-left">
              Task
            </th>
            <th scope="col" className="border p-1 text-left">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td className="border p-1">{t.dueDate}</td>
              <td className="border p-1">{t.title}</td>
              <td className="border p-1">{STATUS[t.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="w-full border-collapse text-sm">
        <caption className="text-left font-semibold">Budget</caption>
        <thead>
          <tr>
            <th scope="col" className="border p-1 text-left">
              Category
            </th>
            <th scope="col" className="border p-1 text-right">
              Allocated
            </th>
            <th scope="col" className="border p-1 text-right">
              Committed
            </th>
            <th scope="col" className="border p-1 text-right">
              Remaining
            </th>
          </tr>
        </thead>
        <tbody>
          {event.budget.map((l) => (
            <tr key={l.id}>
              <th scope="row" className="border p-1 text-left font-normal">
                {l.category}
              </th>
              <td className="border p-1 text-right">{money(l.allocated)}</td>
              <td className="border p-1 text-right">{money(l.committed)}</td>
              <td className="border p-1 text-right">{money(lineStatus(l).remaining)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {booked.length > 0 ? (
        <div>
          <h3 className="font-semibold">Booked vendors</h3>
          <ul>
            {booked.map((v) => (
              <li key={v.id}>
                {v.name} ({v.category}){v.contact ? `: ${v.contact}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
