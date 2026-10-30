import { AlertTriangle, Lock, LockOpen, Pencil, Users } from "lucide-react";
import { useState } from "react";
import { EditLineDialog } from "./EditLineDialog";
import { SourceBadge } from "./SourceBadge";
import { lineStatus } from "../../lib/budget";
import { format } from "../../lib/money";
import { useEventStore } from "../../store/useEventStore";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import type { BudgetLine } from "../../schemas/event";

type Props = { eventId: string; line: BudgetLine; currency: string; isPriority: boolean };

type AmountsProps = { line: BudgetLine; money: (n: number) => string };

/** Allocated, committed, spent and remaining, with a usage bar. */
function LineAmounts({ line, money }: AmountsProps) {
  const s = lineStatus(line);
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted">Allocated</dt>
          <dd className="font-semibold">{money(line.allocated)}</dd>
        </div>
        <div>
          <dt className="text-muted">Committed</dt>
          <dd>{money(line.committed)}</dd>
        </div>
        <div>
          <dt className="text-muted">Spent</dt>
          <dd>{money(line.spent)}</dd>
        </div>
        <div>
          <dt className="text-muted">Remaining</dt>
          <dd className={s.over ? "font-semibold text-danger" : "font-semibold"}>
            {money(s.remaining)}
          </dd>
        </div>
      </dl>

      <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-full bg-line/30">
        <div
          className={`h-full ${s.over ? "bg-danger" : "bg-brand"}`}
          style={{ width: `${Math.min(100, s.percentUsed)}%` }}
        />
      </div>
      <p className="text-sm text-muted">
        {money(s.used)} of {money(line.allocated)} used, {s.percentUsed}%
      </p>
    </>
  );
}

export function CategoryCard({ eventId, line, currency, isPriority }: Props) {
  const lockLine = useEventStore((s) => s.lockLine);
  const [editing, setEditing] = useState(false);
  const s = lineStatus(line);
  const money = (n: number) => format(n, currency);
  const headingId = `line-${line.id}`;

  return (
    <li
      aria-labelledby={headingId}
      className={`space-y-2 rounded-xl border bg-surface p-4 shadow-sm ${s.over ? "border-2 border-danger" : "border-edge"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={headingId} className="mr-auto text-lg font-bold">
          {line.category}
        </h3>
        {isPriority ? <Badge tone="brand">Your priority</Badge> : null}
        <SourceBadge source={line.source} />
      </div>

      <LineAmounts line={line} money={money} />

      <div className="flex flex-wrap items-center gap-2">
        {s.over ? (
          <Badge tone="danger" icon={AlertTriangle}>
            Over by {money(s.overBy)}
          </Badge>
        ) : null}
        {line.perGuest ? <Badge icon={Users}>Scales with guest count</Badge> : null}
        {line.locked ? <Badge icon={Lock}>Locked</Badge> : null}
      </div>

      {line.rationale ? <p className="text-sm">{line.rationale}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${line.category}`}
        >
          <Pencil aria-hidden="true" className="h-4 w-4" />
          Edit
        </Button>
        <Button
          variant="ghost"
          aria-pressed={line.locked}
          aria-label={`Lock ${line.category}`}
          onClick={() => lockLine(eventId, line.id)}
        >
          {line.locked ? (
            <Lock aria-hidden="true" className="h-4 w-4" />
          ) : (
            <LockOpen aria-hidden="true" className="h-4 w-4" />
          )}
          Lock
        </Button>
      </div>

      {editing ? (
        <EditLineDialog
          eventId={eventId}
          line={line}
          currency={currency}
          open={editing}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </li>
  );
}
