import { CalendarClock, Clock, Users, Wallet, type LucideIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { format, parseMoney } from "../../lib/money";
import { shiftDate } from "../../lib/timeline";
import type { ChangeRequest, Event } from "../../schemas/event";
import { Button } from "../ui/Button";
import { Field, inputClass } from "../ui/Field";

type Chip = "budget" | "guests" | "date" | "delay";

const CHIPS: { key: Chip; label: string; icon: LucideIcon }[] = [
  { key: "budget", label: "Budget change", icon: Wallet },
  { key: "guests", label: "Guest change", icon: Users },
  { key: "date", label: "Date change", icon: CalendarClock },
  { key: "delay", label: "Vendor delay", icon: Clock },
];

type Props = {
  event: Event;
  today: string;
  busy: boolean;
  onText: (text: string) => void;
  onRequest: (request: ChangeRequest) => void;
};

/**
 * Free text for the AI to interpret, plus typed quick forms that build a
 * ChangeRequest directly, so changes work even without AI.
 */
export function ChangeBox({ event, today, busy, onText, onRequest }: Props) {
  const { profile } = event;
  const openTasks = event.tasks.filter((t) => t.status !== "done");
  const [text, setText] = useState("");
  const [chip, setChip] = useState<Chip | null>(null);
  const [value, setValue] = useState("");
  const [taskId, setTaskId] = useState(openTasks[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const submitText = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (t === "") {
      setError("Describe what changed, or use one of the quick buttons.");
      return;
    }
    setError(null);
    onText(t.slice(0, 500));
  };

  const submitChip = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const n = Number(value);
    switch (chip) {
      case "budget": {
        const minor = parseMoney(value);
        if (minor === null || minor <= 0) return setError("Enter the new total budget, above 0.");
        return onRequest({ kind: "budget", newTotal: minor });
      }
      case "guests":
        if (!Number.isInteger(n) || n < 1 || n > 1000) {
          return setError("Enter a whole number of guests between 1 and 1000.");
        }
        return onRequest({ kind: "guests", newCount: n });
      case "date":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return setError("Choose the new date.");
        return onRequest({ kind: "date", newDate: value });
      case "delay":
        if (!Number.isInteger(n) || n < 1 || n > 120) {
          return setError("Enter a delay between 1 and 120 days.");
        }
        return onRequest({ kind: "delay", taskId, days: n });
    }
  };

  const openChip = (key: Chip) => {
    setChip(chip === key ? null : key);
    setValue("");
    setError(null);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submitText} noValidate className="space-y-2">
        <Field
          label="What changed?"
          hint={`For example: "budget is now ${format(Math.round(profile.totalBudget * 0.8), profile.currency)}", "15 more guests are coming" or "the caterer is 5 days late".`}
        >
          {(p) => (
            <textarea
              {...p}
              rows={3}
              maxLength={500}
              className={inputClass}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" disabled={busy}>
          Work out the impact
        </Button>
      </form>

      <div className="space-y-2">
        <p className="text-sm font-semibold" id="quick-label">
          Or pick the kind of change
        </p>
        <div role="group" aria-labelledby="quick-label" className="flex flex-wrap gap-2">
          {CHIPS.map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              variant={chip === key ? "primary" : "secondary"}
              aria-expanded={chip === key}
              aria-controls="quick-form"
              onClick={() => openChip(key)}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-danger p-2 font-medium text-danger">
          {error}
        </p>
      ) : null}

      {chip ? (
        <form
          id="quick-form"
          onSubmit={submitChip}
          noValidate
          className="space-y-3 rounded-xl border border-line bg-surface p-4"
        >
          {chip === "budget" ? (
            <Field
              label={`New total budget (${profile.currency})`}
              hint={`Currently ${format(profile.totalBudget, profile.currency)}.`}
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
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
            </Field>
          ) : null}
          {chip === "guests" ? (
            <Field label="New guest count" hint={`Currently ${profile.guestCount}.`} required>
              {(p) => (
                <input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1000}
                  className={inputClass}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
            </Field>
          ) : null}
          {chip === "date" ? (
            <Field label="New event date" hint={`Currently ${profile.date}.`} required>
              {(p) => (
                <input
                  {...p}
                  type="date"
                  min={shiftDate(today, 1)}
                  className={inputClass}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
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
                    onChange={(e) => setTaskId(e.target.value)}
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
                    max={120}
                    className={inputClass}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                )}
              </Field>
            </>
          ) : null}
          <Button type="submit" disabled={busy}>
            See options
          </Button>
        </form>
      ) : null}
    </div>
  );
}
