import { CalendarDays, ListChecks, Trash2, Users, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { countdown, formatDate, taskProgress } from "../../lib/display";
import { format } from "../../lib/money";
import { paths } from "../../routes/paths";
import { Button, buttonClass } from "../ui/Button";
import type { Event } from "../../schemas/event";

type Props = { event: Event; today: string; onDelete: () => void };

/** A saved event on the home page: countdown, key facts and progress. */
export function EventCard({ event: e, today, onDelete }: Props) {
  return (
    <li className="rounded-xl border border-edge bg-surface shadow-sm p-4">
      <h3 className="text-lg font-bold leading-snug">
        <Link to={paths.event(e.id)} className="underline-offset-2 hover:underline">
          {e.profile.title}
        </Link>
      </h3>
      <p className="text-sm font-semibold text-brand">{countdown(e.profile.date, today)}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 text-sm">
        <dt>
          <CalendarDays aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">Date</span>
        </dt>
        <dd>{formatDate(e.profile.date)}</dd>
        <dt>
          <Users aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">Guests</span>
        </dt>
        <dd>{e.profile.guestCount} guests</dd>
        <dt>
          <Wallet aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">Budget</span>
        </dt>
        <dd>{format(e.profile.totalBudget, e.profile.currency)}</dd>
        <dt>
          <ListChecks aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">Tasks done</span>
        </dt>
        <dd>
          {taskProgress(e.tasks).done} of {e.tasks.length} tasks done
        </dd>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to={paths.event(e.id)}
          className={buttonClass("secondary")}
          aria-label={`Open ${e.profile.title}`}
        >
          Open
        </Link>
        <Button variant="ghost" aria-label={`Delete ${e.profile.title}`} onClick={onDelete}>
          <Trash2 aria-hidden="true" className="h-4 w-4" />
          Delete
        </Button>
      </div>
    </li>
  );
}
