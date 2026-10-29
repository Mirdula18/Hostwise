import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useMemo } from "react";
import { summary } from "../../lib/budget";
import { format } from "../../lib/money";
import type { Event } from "../../schemas/event";
import { LiveRegion } from "../ui/LiveRegion";
import { CategoryCard } from "./CategoryCard";

export function BudgetBoard({ event }: { event: Event }) {
  const { profile } = event;
  const s = useMemo(
    () => summary(event.budget, profile.totalBudget),
    [event.budget, profile.totalBudget],
  );
  const money = (n: number) => format(n, profile.currency);

  return (
    <section aria-labelledby="budget-heading" className="space-y-4">
      <h2 id="budget-heading" className="text-xl font-bold">
        Budget
      </h2>
      <LiveRegion className="rounded-xl border border-line bg-surface p-4">
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
      <p className="text-sm text-muted">
        Editing a category can rebalance the others by your priorities. Lock a category to protect
        it from rebalancing and trade-offs.
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
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
