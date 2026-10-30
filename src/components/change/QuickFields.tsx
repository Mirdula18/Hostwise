import { LIMITS } from "../../lib/constants";
import { format } from "../../lib/money";
import { shiftDate } from "../../lib/timeline";
import { Field, inputClass } from "../ui/Field";
import type { QuickChangeKind } from "../../lib/forms";
import type { Event } from "../../schemas/event";

type Props = {
  chip: QuickChangeKind;
  event: Event;
  today: string;
  value: string;
  onValue: (value: string) => void;
  taskId: string;
  onTaskId: (id: string) => void;
};

/** The inputs for one quick change: budget, guests, date, or a delayed task and days. */
export function QuickFields({ chip, event, today, value, onValue, taskId, onTaskId }: Props) {
  const openTasks = event.tasks.filter((t) => t.status !== "done");
  return (
    <>
      {chip === "budget" ? (
        <Field
          label={`New total budget (${event.profile.currency})`}
          hint={`Currently ${format(event.profile.totalBudget, event.profile.currency)}.`}
          required
        >
          {(p) => (
            <input
              {...p}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              className={inputClass}
              value={value}
              onChange={(e) => onValue(e.target.value)}
            />
          )}
        </Field>
      ) : null}
      {chip === "guests" ? (
        <Field label="New guest count" hint={`Currently ${event.profile.guestCount}.`} required>
          {(p) => (
            <input
              {...p}
              type="number"
              inputMode="numeric"
              min={1}
              max={LIMITS.GUESTS_MAX}
              className={inputClass}
              value={value}
              onChange={(e) => onValue(e.target.value)}
            />
          )}
        </Field>
      ) : null}
      {chip === "date" ? (
        <Field label="New event date" hint={`Currently ${event.profile.date}.`} required>
          {(p) => (
            <input
              {...p}
              type="date"
              min={shiftDate(today, 1)}
              className={inputClass}
              value={value}
              onChange={(e) => onValue(e.target.value)}
            />
          )}
        </Field>
      ) : null}
      {chip === "delay" ? (
        <>
          <Field label="Which task is delayed?" required>
            {(p) => (
              <select
                {...p}
                className={inputClass}
                value={taskId}
                onChange={(e) => onTaskId(e.target.value)}
              >
                {openTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Delay in days" required>
            {(p) => (
              <input
                {...p}
                type="number"
                inputMode="numeric"
                min={1}
                max={LIMITS.DELAY_DAYS_MAX}
                className={inputClass}
                value={value}
                onChange={(e) => onValue(e.target.value)}
              />
            )}
          </Field>
        </>
      ) : null}
    </>
  );
}
