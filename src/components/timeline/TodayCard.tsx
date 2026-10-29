import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useMemo } from "react";
import { isOverdue, todayTop3 } from "../../lib/timeline";
import type { Event } from "../../schemas/event";
import { useEventStore } from "../../store/useEventStore";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

type Props = { event: Event; today: string };

/** The next three things to do; updates as soon as a task is marked done. */
export function TodayCard({ event, today }: Props) {
  const updateTask = useEventStore((s) => s.updateTask);
  const top = useMemo(
    () => todayTop3(event.tasks, today, event.profile.priorities),
    [event.tasks, today, event.profile.priorities],
  );
  return (
    <section
      aria-labelledby="today-heading"
      className="rounded-xl border-2 border-brand bg-surface p-4"
    >
      <h2 id="today-heading" className="text-lg font-bold">
        Do next
      </h2>
      {top.length === 0 ? (
        <p className="mt-2 flex items-center gap-2">
          <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-ok" />
          Nothing waiting right now. Nice work.
        </p>
      ) : (
        <ol className="mt-2 space-y-2">
          {top.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2">
              <span className="flex-1">
                <span className="font-semibold">{t.title}</span>
                <span className="block text-sm text-muted">Due {t.dueDate}</span>
              </span>
              {isOverdue(t, today) ? (
                <Badge tone="danger" icon={AlertTriangle}>
                  Overdue
                </Badge>
              ) : null}
              <Button
                variant="secondary"
                aria-label={`Mark done: ${t.title}`}
                onClick={() => updateTask(event.id, t.id, { status: "done" })}
              >
                Mark done
              </Button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
