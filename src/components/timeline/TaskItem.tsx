import { AlertTriangle, Clock, Lock, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatDate } from "../../lib/display";
import { blockers, isAtRisk, isOverdue } from "../../lib/timeline";
import { TaskStatus, type Event, type Task } from "../../schemas/event";
import { useEventStore } from "../../store/useEventStore";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { DelayDialog } from "./DelayDialog";
import { TaskForm } from "./TaskForm";

const STATUS_LABEL: Record<TaskStatus, string> = { todo: "To do", doing: "Doing", done: "Done" };

type Props = { event: Event; task: Task; today: string };

export function TaskItem({ event, task, today }: Props) {
  const updateTask = useEventStore((s) => s.updateTask);
  const deleteTask = useEventStore((s) => s.deleteTask);
  const [dialog, setDialog] = useState<"delay" | "edit" | null>(null);
  const waitingOn = blockers(task, event.tasks);
  const statusId = `status-${task.id}`;

  return (
    <li className="space-y-2 rounded-xl border border-edge bg-surface p-3 shadow-sm">
      <div className="flex flex-wrap items-start gap-2">
        <div className="mr-auto">
          <h4
            className={`font-semibold ${task.status === "done" ? "text-muted line-through" : ""}`}
          >
            {task.title}
          </h4>
          <p className="text-sm text-muted">
            Due <time dateTime={task.dueDate}>{formatDate(task.dueDate)}</time>
            {task.category ? ` · ${task.category}` : ""}
            {task.custom ? " · Added by you" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {task.status !== "done" ? (
            <>
              <Button
                variant="secondary"
                onClick={() => setDialog("delay")}
                aria-label={`Delay ${task.title}`}
              >
                <Clock aria-hidden="true" className="h-4 w-4" />
                Delay
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDialog("edit")}
                aria-label={`Edit ${task.title}`}
              >
                <Pencil aria-hidden="true" className="h-4 w-4" />
                Edit
              </Button>
              {task.custom ? (
                <Button
                  variant="ghost"
                  onClick={() => deleteTask(event.id, task.id)}
                  aria-label={`Delete ${task.title}`}
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  Delete
                </Button>
              ) : null}
            </>
          ) : null}
          <label htmlFor={statusId} className="sr-only">
            Status for {task.title}
          </label>
          <select
            id={statusId}
            value={task.status}
            onChange={(e) =>
              updateTask(event.id, task.id, { status: TaskStatus.parse(e.target.value) })
            }
            className="min-h-11 rounded-lg border border-line bg-surface px-2"
          >
            {TaskStatus.options.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 empty:hidden">
        {waitingOn.length > 0 && task.status !== "done" ? (
          <Badge tone="warn" icon={Lock}>
            Blocked by {waitingOn.map((t) => t.title).join(", ")}
          </Badge>
        ) : null}
        {isAtRisk(task, event.profile.date) ? (
          <Badge tone="danger" icon={AlertTriangle}>
            At risk: due after the event
          </Badge>
        ) : null}
        {isOverdue(task, today) ? (
          <Badge tone="danger" icon={Clock}>
            Overdue
          </Badge>
        ) : null}
        {task.delayDays > 0 ? <Badge icon={Clock}>Delayed {task.delayDays} days</Badge> : null}
      </div>

      {dialog === "delay" ? (
        <DelayDialog event={event} task={task} open onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "edit" ? (
        <TaskForm event={event} task={task} open onClose={() => setDialog(null)} />
      ) : null}
    </li>
  );
}
