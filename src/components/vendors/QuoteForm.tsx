import { useState, type FormEvent } from "react";
import { TEXT } from "../../lib/constants";
import { quoteInput } from "../../lib/forms";
import { useEventStore } from "../../store/useEventStore";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field, inputClass } from "../ui/Field";
import type { Vendor } from "../../schemas/event";

type Props = {
  eventId: string;
  vendor: Vendor;
  currency: string;
  open: boolean;
  onClose: () => void;
};

/** A quote the host received. Only these user-entered numbers are ever shown as prices. */
export function QuoteForm({ eventId, vendor, currency, open, onClose }: Props) {
  const addQuote = useEventStore((s) => s.addQuote);
  const [amount, setAmount] = useState("");
  const [includes, setIncludes] = useState("");
  const [deposit, setDeposit] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [cancellation, setCancellation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const input = quoteInput({ amount, includes, deposit, validUntil, cancellation });
    if (!input.ok) {
      setError(input.error);
      return;
    }
    const r = addQuote(eventId, vendor.id, input.value);
    if (!r.ok) {
      setError("That quote could not be saved.");
      return;
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Add a quote from ${vendor.name}`}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? (
          <p role="alert" className="rounded-lg border border-danger p-2 text-danger">
            {error}
          </p>
        ) : null}
        <Field label={`Quoted amount (${currency})`} required>
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
        <Field label="What's included">
          {(p) => (
            <textarea
              {...p}
              rows={2}
              maxLength={TEXT.CHANGE}
              className={inputClass}
              value={includes}
              onChange={(e) => setIncludes(e.target.value)}
            />
          )}
        </Field>
        <Field label={`Deposit (${currency})`}>
          {(p) => (
            <input
              {...p}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              className={inputClass}
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
          )}
        </Field>
        <Field label="Valid until">
          {(p) => (
            <input
              {...p}
              type="date"
              className={inputClass}
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          )}
        </Field>
        <Field label="Cancellation terms">
          {(p) => (
            <input
              {...p}
              maxLength={TEXT.NOTE}
              className={inputClass}
              value={cancellation}
              onChange={(e) => setCancellation(e.target.value)}
            />
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add quote</Button>
        </div>
      </form>
    </Dialog>
  );
}
