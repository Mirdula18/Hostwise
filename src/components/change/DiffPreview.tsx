import { AlertTriangle } from "lucide-react";
import { format } from "../../lib/money";
import type { EventDiff } from "../../lib/ranking";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

type Props = {
  label: string;
  diff: EventDiff;
  currency: string;
  eventDate: string;
  onApply: () => void;
  onCancel: () => void;
};

const signed = (n: number, currency: string) =>
  n === 0 ? "No change" : `${n > 0 ? "+" : "−"}${format(Math.abs(n), currency)}`;

/** Before/after for every category and moved task, so nothing changes blindly. */
export function DiffPreview({ label, diff, currency, eventDate, onApply, onCancel }: Props) {
  const money = (n: number) => format(n, currency);
  return (
    <section
      aria-labelledby="preview-heading"
      className="space-y-3 rounded-xl border-2 border-brand bg-surface p-4"
    >
      <h2 id="preview-heading" className="text-xl font-bold">
        Preview: {label}
      </h2>
      <ul className="text-sm">
        {diff.guests.before !== diff.guests.after ? (
          <li>
            Guests: {diff.guests.before} → <strong>{diff.guests.after}</strong>
          </li>
        ) : null}
        {diff.total.before !== diff.total.after ? (
          <li>
            Total budget: {money(diff.total.before)} → <strong>{money(diff.total.after)}</strong>
          </li>
        ) : null}
        {diff.date.before !== diff.date.after ? (
          <li>
            Event date: {diff.date.before} → <strong>{diff.date.after}</strong>
          </li>
        ) : null}
      </ul>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <caption className="pb-2 text-left font-semibold">Budget before and after</caption>
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className="p-2">
                Category
              </th>
              <th scope="col" className="p-2 text-right">
                Before
              </th>
              <th scope="col" className="p-2 text-right">
                After
              </th>
              <th scope="col" className="p-2 text-right">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {diff.lines.map((l) => (
              <tr key={l.category} className="border-b border-line">
                <th scope="row" className="p-2 font-medium">
                  {l.category}
                </th>
                <td className="p-2 text-right">{money(l.before)}</td>
                <td className="p-2 text-right font-semibold">{money(l.after)}</td>
                <td className={`p-2 text-right ${l.delta < 0 ? "text-danger" : ""}`}>
                  {signed(l.delta, currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="p-2">
                Total
              </th>
              <td className="p-2 text-right">{money(diff.total.before)}</td>
              <td className="p-2 text-right font-bold">{money(diff.total.after)}</td>
              <td className="p-2 text-right">
                {signed(diff.total.after - diff.total.before, currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {diff.tasks.length > 0 ? (
        <div>
          <h3 className="font-semibold">Tasks that move</h3>
          <ul className="space-y-1 text-sm">
            {diff.tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {t.title}: {t.before} → <strong>{t.after}</strong>
                </span>
                {t.after > (diff.date.after || eventDate) ? (
                  <Badge tone="danger" icon={AlertTriangle}>
                    After the event
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onApply}>Apply this change</Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
