import { CalendarClock, Clock, Users, Wallet, type LucideIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { QuickFields } from "./QuickFields";
import { TEXT } from "../../lib/constants";
import { quickChange, type QuickChangeKind } from "../../lib/forms";
import { format } from "../../lib/money";
import { Button } from "../ui/Button";
import { Field, inputClass } from "../ui/Field";
import type { ChangeRequest, Event } from "../../schemas/event";

/** The budget example suggests a 20% cut. */
const EXAMPLE_BUDGET_FACTOR = 0.8;

type Chip = QuickChangeKind;

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
    onText(t.slice(0, TEXT.CHANGE));
  };

  const submitChip = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (chip === null) return;
    const r = quickChange(chip, value, taskId);
    if (r.ok) onRequest(r.value);
    else setError(r.error);
  };

  const examples = [
    `Budget is now ${format(Math.round(profile.totalBudget * EXAMPLE_BUDGET_FACTOR), profile.currency)}`,
    "15 more guests are coming",
    "The caterer is 5 days late",
  ];

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
          hint="Describe it in your own words, or start from an example below."
        >
          {(p) => (
            <textarea
              {...p}
              rows={3}
              maxLength={TEXT.CHANGE}
              className={inputClass}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
        </Field>
        <div role="group" aria-label="Examples" className="flex flex-wrap items-center gap-2">
          <span aria-hidden="true" className="text-sm text-muted">
            Try:
          </span>
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              aria-label={`Use example: ${ex}`}
              onClick={() => setText(ex)}
              className="min-h-11 rounded-full border border-line bg-surface px-3 text-sm hover:border-brand hover:text-brand"
            >
              {ex}
            </button>
          ))}
        </div>
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
          className="space-y-3 rounded-xl border border-edge bg-surface shadow-sm p-4"
        >
          <QuickFields
            chip={chip}
            event={event}
            today={today}
            value={value}
            onValue={setValue}
            taskId={taskId}
            onTaskId={setTaskId}
          />
          <Button type="submit" disabled={busy}>
            See options
          </Button>
        </form>
      ) : null}
    </div>
  );
}
