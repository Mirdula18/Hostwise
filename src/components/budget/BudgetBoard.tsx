import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useMemo } from "react";
import { CategoryCard } from "./CategoryCard";
import { summary } from "../../lib/budget";
import { shares } from "../../lib/display";
import { format } from "../../lib/money";
import { LiveRegion } from "../ui/LiveRegion";
import type { Event } from "../../schemas/event";

/** Decorative swatches; every segment is also named with its percent in the legend. */
const SPLIT_COLOURS = [
  "bg-brand",
  "bg-ok",
  "bg-warn",
  "bg-focus",
  "bg-ink",
  "bg-muted",
  "bg-brand/60",
  "bg-ok/60",
  "bg-warn/60",
  "bg-focus/60",
];

export function BudgetBoard({ event }: { event: Event }) {
  const { profile } = event;
  const s = useMemo(
    () => summary(event.budget, profile.totalBudget),
    [event.budget, profile.totalBudget],
  );
  const money = (n: number) => format(n, profile.currency);
  const split = useMemo(() => shares(event.budget.map((l) => l.allocated)), [event.budget]);

  return (
    <section aria-labelledby="budget-heading" className="space-y-4">
      <h2 id="budget-heading" className="text-xl font-bold">
        Budget
      </h2>
      <LiveRegion className="rounded-xl border border-edge bg-surface shadow-sm p-4">
        <p>
          <span className="font-semibold">{money(s.allocated)}</span> allocated of{" "}
          <span className="font-semibold">{money(s.total)}</span>. {money(s.committed)} committed,{" "}
          {money(s.spent)} spent.
        </p>
        {s.unallocated !== 0 ? (
          <p className="text-sm text-muted">
            {s.unallocated > 0
              ? `${money(s.unallocated)} is not assigned to a category yet.`
              : `Categories add up to ${money(-s.unallocated)} more than the total.`}
          </p>
        ) : null}
        <p className="mt-1 flex items-center gap-2 font-medium">
          {s.overBudget ? (
            <>
              <AlertTriangle aria-hidden="true" className="h-5 w-5 text-danger" />
              <span className="text-danger">Over budget: check the categories marked below.</span>
            </>
          ) : (
            <>
              <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-ok" />
              Within budget.
            </>
          )}
        </p>
      </LiveRegion>
      {event.budget.length > 0 ? (
        <figure className="space-y-2">
          <figcaption className="text-sm font-semibold">Where the money goes</figcaption>
          <div aria-hidden="true" className="flex h-4 overflow-hidden rounded-full bg-line/30">
            {event.budget.map((line, i) => (
              <div
                key={line.id}
                className={`h-full border-r-2 border-surface last:border-r-0 ${SPLIT_COLOURS[i % SPLIT_COLOURS.length]}`}
                style={{ width: `${split[i] ?? 0}%` }}
              />
            ))}
          </div>
          <ul aria-label="Budget split" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {event.budget.map((line, i) => (
              <li key={line.id} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`h-3 w-3 rounded-sm ${SPLIT_COLOURS[i % SPLIT_COLOURS.length]}`}
                />
                {line.category} {Math.round(split[i] ?? 0)}%
              </li>
            ))}
          </ul>
        </figure>
      ) : null}
      <p className="text-sm text-muted">
        Editing a category can rebalance the others by your priorities. Lock a category to protect
        it from rebalancing and trade-offs.
      </p>
      <ul aria-label="Categories" className="grid gap-3 md:grid-cols-2">
        {event.budget.map((line) => (
          <CategoryCard
            key={line.id}
            eventId={event.id}
            line={line}
            currency={profile.currency}
            isPriority={
              line.priorityTag !== undefined && profile.priorities.includes(line.priorityTag)
            }
          />
        ))}
      </ul>
    </section>
  );
}
