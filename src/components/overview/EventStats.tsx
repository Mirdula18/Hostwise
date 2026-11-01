import { CalendarDays, ListChecks, Users, Wallet } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { summary } from "../../lib/budgetStatus";
import { countdown, formatDate, taskProgress } from "../../lib/display";
import { format } from "../../lib/money";
import type { Event } from "../../schemas/event";
import type { LucideIcon } from "lucide-react";

type TileProps = { icon: LucideIcon; label: string; value: string; children?: ReactNode };

function Tile({ icon: Icon, label, value, children }: TileProps) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-3 shadow-sm">
      <dt className="flex items-center gap-1.5 text-sm text-muted">
        <Icon aria-hidden="true" className="h-4 w-4" />
        {label}
      </dt>
      <dd className="mt-1 text-lg font-bold">{value}</dd>
      {children}
    </div>
  );
}

/** Countdown, task progress and money left, so the host sees where things stand at a glance. */
export function EventStats({ event, today }: { event: Event; today: string }) {
  const { profile } = event;
  const progress = useMemo(() => taskProgress(event.tasks), [event.tasks]);
  const budget = useMemo(
    () => summary(event.budget, profile.totalBudget),
    [event.budget, profile.totalBudget],
  );
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile icon={CalendarDays} label="Event day" value={countdown(profile.date, today)}>
        <dd className="text-sm text-muted">{formatDate(profile.date)}</dd>
      </Tile>
      <Tile icon={Users} label="Guests" value={`${profile.guestCount} guests`} />
      <Tile icon={ListChecks} label="Tasks done" value={`${progress.done} of ${progress.total}`}>
        <dd className="mt-2">
          <div
            role="progressbar"
            aria-label="Tasks done"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
            aria-valuetext={`${progress.percent}%`}
            className="h-2 overflow-hidden rounded-full bg-line/30"
          >
            <div className="h-full bg-ok" style={{ width: `${progress.percent}%` }} />
          </div>
        </dd>
      </Tile>
      <Tile
        icon={Wallet}
        label="Still available"
        value={format(budget.remaining, profile.currency)}
      >
        <dd className="text-sm text-muted">of {format(profile.totalBudget, profile.currency)}</dd>
      </Tile>
    </dl>
  );
}
