import { useState, type FormEvent } from "react";
import { format, fromMinor, parseMoney } from "../../lib/money";
import { useEventStore, type EditMode } from "../../store/useEventStore";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field, inputClass } from "../ui/Field";
import type { RebalanceError } from "../../lib/budget";
import type { BudgetLine } from "../../schemas/event";

function explain(e: RebalanceError, currency: string): string {
  switch (e.kind) {
    case "below_committed":
      return `This category already has ${format(e.minimum, currency)} committed or spent. Choose at least that.`;
    case "insufficient_unlocked":
      return `Other unlocked categories are ${format(e.shortBy, currency)} short. Unlock a category, choose a smaller amount, or change the total instead.`;
    case "no_unlocked":
      return "Every other category is locked, so there is nowhere to move the money. Unlock one or change the total instead.";
    default:
      return "Enter an amount of 0 or more.";
  }
}

const MODES: { value: EditMode; label: string; description: string }[] = [
  {
    value: "rebalance",
    label: "Rebalance others by priority",
    description:
      "Your total stays the same. Money moves from your lowest priorities first; locked categories are never touched.",
  },
  {
    value: "changeTotal",
    label: "Keep others; change total",
    description: "Other categories stay as they are and your total budget changes.",
  },
];

type Props = {
  eventId: string;
  line: BudgetLine;
  currency: string;
  open: boolean;
  onClose: () => void;
};

export function EditLineDialog({ eventId, line, currency, open, onClose }: Props) {
  const updateBudgetLine = useEventStore((s) => s.updateBudgetLine);
  const setLineSpent = useEventStore((s) => s.setLineSpent);
  const [amount, setAmount] = useState(String(fromMinor(line.allocated)));
  const [spent, setSpent] = useState(String(fromMinor(line.spent)));
  const [mode, setMode] = useState<EditMode>("rebalance");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const nextAmount = parseMoney(amount);
    const nextSpent = parseMoney(spent);
    if (nextAmount === null || nextSpent === null) {
      setError("Enter amounts as numbers, for example 12500 or 12500.50.");
      return;
    }
    if (nextAmount !== line.allocated) {
      const r = updateBudgetLine(eventId, line.id, nextAmount, mode);
      if (!r.ok) {
        setError(explain(r.error, currency));
        return;
      }
    }
    if (nextSpent !== line.spent) setLineSpent(eventId, line.id, nextSpent);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Edit ${line.category}`}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? (
          <p role="alert" className="rounded-lg border border-danger p-2 text-danger">
            {error}
          </p>
        ) : null}
        <Field label={`Amount for ${line.category} (${currency})`} required>
          {(p) => (
            <input
              {...p}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">When this amount changes</legend>
          {MODES.map((m) => (
            <div key={m.value} className="flex min-h-11 items-start gap-3">
              <input
                id={`mode-${m.value}`}
                type="radio"
                name="mode"
                className="mt-1 h-5 w-5"
                aria-describedby={`mode-${m.value}-desc`}
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
              />
              <div>
                <label htmlFor={`mode-${m.value}`} className="font-medium">
                  {m.label}
                </label>
                <p id={`mode-${m.value}-desc`} className="text-sm text-muted">
                  {m.description}
                </p>
              </div>
            </div>
          ))}
        </fieldset>
        <Field label={`Spent so far (${currency})`} hint="Money you've already paid out.">
          {(p) => (
            <input
              {...p}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              className={inputClass}
              value={spent}
              onChange={(e) => setSpent(e.target.value)}
            />
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Dialog>
  );
}
