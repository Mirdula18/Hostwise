import { AlertTriangle } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { isAtRisk, shiftWithDependents } from "../../lib/timeline";
import type { Event, Task } from "../../schemas/event";
import { useEventStore } from "../../store/useEventStore";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field, inputClass } from "../ui/Field";
import { LiveRegion } from "../ui/LiveRegion";
import { toast } from "../ui/Toast";

type Props = { event: Event; task: Task; open: boolean; onClose: () => void };

/** "Vendor delayed by N days": preview the ripple effect, then confirm. */
export function DelayDialog({ event, task, open, onClose }: Props) {
  const delayTask = useEventStore((s) => s.delayTask);
  const undo = useEventStore((s) => s.undo);
  const [days, setDays] = useState("3");
  const n = Number(days);
  const valid = Number.isInteger(n) && n >= 1 && n <= 120;

  const preview = useMemo(() => {
    if (!valid) return null;
    const r = shiftWithDependents(event.tasks, task.id, n, event.profile.date);
    return r.ok ? r.value : null;
  }, [valid, event.tasks, event.profile.date, task.id, n]);

  const confirm = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const r = delayTask(event.id, task.id, n);
    if (r.ok) {
      toast(`Moved ${preview?.affectedIds.length ?? 1} task(s) by ${n} days.`, {
        label: "Undo",
        onClick: () => undo(event.id),
      });
      onClose();
    }
  };

  const before = new Map(event.tasks.map((t) => [t.id, t.dueDate]));
  const affected = preview?.tasks.filter((t) => preview.affectedIds.includes(t.id)) ?? [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Delay "${task.title}"`}
      description="This task and every task that depends on it move by the same number of days."
    >
      <form onSubmit={confirm} noValidate className="space-y-4">
        <Field
          label="Delayed by how many days?"
          hint="Between 1 and 120."
          error={valid ? undefined : "Enter a whole number from 1 to 120."}
          required
        >
          {(p) => (
            <input
              {...p}
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              className={inputClass}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          )}
        </Field>
        <LiveRegion>
          {preview ? (
            <div className="space-y-2">
              <h3 className="font-semibold">
                {affected.length} task{affected.length === 1 ? "" : "s"} will move
              </h3>
              <ul className="space-y-1 text-sm">
                {affected.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2">
                    <span className="flex-1">
                      {t.title}: {before.get(t.id)} → <strong>{t.dueDate}</strong>
                    </span>
                    {isAtRisk(t, event.profile.date) ? (
                      <Badge tone="danger" icon={AlertTriangle}>
                        After the event
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </LiveRegion>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid}>
            Apply delay
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
