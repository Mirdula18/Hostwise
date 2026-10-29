import { useState, type FormEvent } from "react";
import { transitiveDependents } from "../../lib/timeline";
import type { Event, Task } from "../../schemas/event";
import { useEventStore } from "../../store/useEventStore";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field, inputClass } from "../ui/Field";

type Props = { event: Event; task?: Task; open: boolean; onClose: () => void };

/** Add a custom task, or edit an existing one. Circular dependencies are refused. */
export function TaskForm({ event, task, open, onClose }: Props) {
  const addTask = useEventStore((s) => s.addTask);
  const updateTask = useEventStore((s) => s.updateTask);
  const [title, setTitle] = useState(task?.title ?? "");
  const [category, setCategory] = useState(task?.category ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? event.profile.date);
  const [deps, setDeps] = useState<string[]>(task?.dependsOn ?? []);
  const [error, setError] = useState<string | null>(null);

  // A task cannot wait for itself or for anything that already waits for it.
  const excluded = new Set(task ? [task.id, ...transitiveDependents(event.tasks, task.id)] : []);
  const candidates = event.tasks.filter((t) => !excluded.has(t.id));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim() === "" || title.length > 120) {
      setError("Give the task a title (up to 120 characters).");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      setError("Choose a due date.");
      return;
    }
    const input = {
      title: title.trim(),
      category: category.trim().slice(0, 40),
      dueDate,
      dependsOn: deps,
    };
    const r = task ? updateTask(event.id, task.id, input) : addTask(event.id, input);
    if (!r.ok) {
      setError(r.error.kind === "cycle" ? r.error.message : "That task could not be saved.");
      return;
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={task ? "Edit task" : "Add a task"}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? (
          <p role="alert" className="rounded-lg border border-danger p-2 text-danger">
            {error}
          </p>
        ) : null}
        <Field label="Task" required>
          {(p) => (
            <input
              {...p}
              className={inputClass}
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>
        <Field label="Category" hint="For example: Catering, Venue, Guests.">
          {(p) => (
            <input
              {...p}
              className={inputClass}
              value={category}
              maxLength={40}
              onChange={(e) => setCategory(e.target.value)}
            />
          )}
        </Field>
        <Field label="Due date" required>
          {(p) => (
            <input
              {...p}
              type="date"
              className={inputClass}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          )}
        </Field>
        {candidates.length > 0 ? (
          <fieldset className="space-y-1">
            <legend className="text-sm font-semibold">Waits for (optional)</legend>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
              {candidates.map((t) => (
                <label key={t.id} className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={deps.includes(t.id)}
                    onChange={(e) =>
                      setDeps(e.target.checked ? [...deps, t.id] : deps.filter((d) => d !== t.id))
                    }
                  />
                  {t.title}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{task ? "Save task" : "Add task"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
