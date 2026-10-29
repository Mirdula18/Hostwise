import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { bucket, type Buckets } from "../../lib/timeline";
import type { Event } from "../../schemas/event";
import { Button } from "../ui/Button";
import { TaskForm } from "./TaskForm";
import { TaskItem } from "./TaskItem";
import { TodayCard } from "./TodayCard";

const GROUPS: { key: keyof Buckets; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "thisWeek", label: "This week" },
  { key: "nextTwoWeeks", label: "Next 2 weeks" },
  { key: "later", label: "Later" },
  { key: "done", label: "Done" },
];

export function TaskList({ event, today }: { event: Event; today: string }) {
  const [adding, setAdding] = useState(false);
  const groups = useMemo(() => bucket(event.tasks, today), [event.tasks, today]);

  return (
    <section aria-labelledby="timeline-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="timeline-heading" className="text-xl font-bold">
          Timeline
        </h2>
        <Button variant="secondary" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add a task
        </Button>
      </div>
      <TodayCard event={event} today={today} />
      {GROUPS.map(({ key, label }) =>
        groups[key].length > 0 ? (
          <section key={key} aria-labelledby={`group-${key}`} className="space-y-2">
            <h3 id={`group-${key}`} className="text-lg font-bold">
              {label} <span className="text-sm font-normal text-muted">({groups[key].length})</span>
            </h3>
            <ul className="space-y-2">
              {groups[key].map((t) => (
                <TaskItem key={t.id} event={event} task={t} today={today} />
              ))}
            </ul>
          </section>
        ) : null,
      )}
      {adding ? <TaskForm event={event} open onClose={() => setAdding(false)} /> : null}
    </section>
  );
}
