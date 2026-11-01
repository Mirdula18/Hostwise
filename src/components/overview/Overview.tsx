import { AlertTriangle, Lightbulb } from "lucide-react";
import { useMemo } from "react";
import { ChangeHistory } from "./ChangeHistory";
import { summary } from "../../lib/budgetStatus";
import { displayAnswer } from "../../lib/intake";
import { FIELD_SPECS, type IntakeField } from "../../lib/intakeFallback";
import { format } from "../../lib/money";
import { TodayCard } from "../timeline/TodayCard";
import { Badge } from "../ui/Badge";
import type { Event } from "../../schemas/event";

const PROFILE_ROWS: [IntakeField, string][] = [
  ["priorities", "Priorities"],
  ["ageMix", "Age groups"],
  ["accessibility", "Accessibility"],
  ["dietary", "Dietary"],
  ["culturalContext", "Cultural context"],
  ["setting", "Setting"],
  ["city", "City"],
];

type Props = { event: Event; today: string };

export function Overview({ event, today }: Props) {
  const { profile } = event;
  const s = useMemo(
    () => summary(event.budget, profile.totalBudget),
    [event.budget, profile.totalBudget],
  );
  const money = (n: number) => format(n, profile.currency);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TodayCard event={event} today={today} />
      <ChangeHistory event={event} />

      <section
        aria-labelledby="glance-heading"
        className="rounded-xl border border-edge bg-surface shadow-sm p-4"
      >
        <h2 id="glance-heading" className="text-lg font-bold">
          Budget at a glance
        </h2>
        <dl className="mt-2 grid grid-cols-2 gap-1 text-sm">
          <dt>Total budget</dt>
          <dd className="text-right font-semibold">{money(s.total)}</dd>
          <dt>Committed (accepted quotes)</dt>
          <dd className="text-right">{money(s.committed)}</dd>
          <dt>Spent</dt>
          <dd className="text-right">{money(s.spent)}</dd>
          <dt>Still available</dt>
          <dd className="text-right font-semibold">{money(s.remaining)}</dd>
        </dl>
        {s.overBudget ? (
          <p className="mt-2">
            <Badge tone="danger" icon={AlertTriangle}>
              Over budget in {s.overLineIds.length || 1} place
              {s.overLineIds.length === 1 ? "" : "s"}
            </Badge>
          </p>
        ) : null}
        <p className="mt-2 text-sm text-muted">
          Amounts are estimates until you add your own numbers or vendor quotes.
        </p>
      </section>

      {event.theme ? (
        <section
          aria-labelledby="theme-heading"
          className="rounded-xl border border-edge bg-surface shadow-sm p-4"
        >
          <h2 id="theme-heading" className="text-lg font-bold">
            Theme idea
          </h2>
          <p className="mt-2">{event.theme}</p>
        </section>
      ) : null}

      <section
        aria-labelledby="assumed-heading"
        className="rounded-xl border border-edge bg-surface shadow-sm p-4"
      >
        <h2 id="assumed-heading" className="flex items-center gap-2 text-lg font-bold">
          <Lightbulb aria-hidden="true" className="h-5 w-5 text-warn" />
          What I assumed
        </h2>
        {event.assumptions.length === 0 ? (
          <p className="mt-2 text-muted">No assumptions recorded.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {event.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-muted">Check these and adjust the plan if any are wrong.</p>
      </section>

      <section
        aria-labelledby="about-heading"
        className="rounded-xl border border-edge bg-surface shadow-sm p-4 md:col-span-2"
      >
        <h2 id="about-heading" className="text-lg font-bold">
          About this event
        </h2>
        <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
          {PROFILE_ROWS.filter(([f]) => profile[f] !== undefined).map(([f, label]) => (
            <div key={f} className="contents">
              <dt className="font-semibold" title={FIELD_SPECS[f].question}>
                {label}
              </dt>
              <dd>{displayAnswer(f, profile)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
