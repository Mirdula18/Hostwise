import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useMemo } from "react";
import { format } from "../../lib/money";
import { compareQuotes } from "../../lib/vendors";
import type { Event } from "../../schemas/event";
import { useEventStore } from "../../store/useEventStore";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { toast } from "../ui/Toast";

type Props = { event: Event; category: string };

/** Quotes in one category side by side, against what the budget allocates. */
export function QuoteCompare({ event, category }: Props) {
  const acceptQuote = useEventStore((s) => s.acceptQuote);
  const unacceptQuote = useEventStore((s) => s.unacceptQuote);
  const line = event.budget.find((l) => l.category === category);
  const allocated = line?.allocated ?? 0;
  const rows = useMemo(
    () => compareQuotes(event.vendors, category, allocated),
    [event.vendors, category, allocated],
  );
  const money = (n: number) => format(n, event.profile.currency);
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <caption className="p-3 text-left font-semibold">
          {category} quotes compared with {money(allocated)} allocated
        </caption>
        <thead className="border-y border-line bg-bg">
          <tr>
            <th scope="col" className="p-2">
              Vendor
            </th>
            <th scope="col" className="p-2">
              Quote
            </th>
            <th scope="col" className="p-2">
              Against budget
            </th>
            <th scope="col" className="p-2">
              Includes
            </th>
            <th scope="col" className="p-2">
              Deposit
            </th>
            <th scope="col" className="p-2">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.quote.id} className="border-b border-line last:border-0">
              <th scope="row" className="p-2 font-semibold">
                {r.vendorName}
              </th>
              <td className="p-2">{money(r.quote.amount)}</td>
              <td className="p-2">
                {r.over ? (
                  <Badge tone="danger" icon={AlertTriangle}>
                    Over by {money(r.overBy)}
                  </Badge>
                ) : (
                  <Badge tone="ok" icon={CheckCircle2}>
                    Within budget
                  </Badge>
                )}
              </td>
              <td className="p-2">{r.quote.includes || "—"}</td>
              <td className="p-2">
                {r.quote.deposit !== undefined ? money(r.quote.deposit) : "—"}
              </td>
              <td className="p-2">
                {r.quote.accepted ? (
                  <Button
                    variant="ghost"
                    aria-label={`Unaccept ${r.vendorName} quote`}
                    onClick={() => unacceptQuote(event.id, r.vendorId, r.quote.id)}
                  >
                    Accepted · Undo
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    aria-label={`Accept ${r.vendorName} quote of ${money(r.quote.amount)}`}
                    onClick={() => {
                      const res = acceptQuote(event.id, r.vendorId, r.quote.id);
                      toast(
                        res.ok
                          ? `Accepted ${r.vendorName}. ${category} now shows a vendor quote.`
                          : "That quote could not be accepted.",
                      );
                    }}
                  >
                    Accept
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
