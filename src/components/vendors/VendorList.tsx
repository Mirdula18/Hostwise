import { Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { useState } from "react";
import { QuestionList } from "./QuestionList";
import { QuoteCompare } from "./QuoteCompare";
import { QuoteForm } from "./QuoteForm";
import { STATUS_LABELS, VendorForm } from "./VendorForm";
import { format } from "../../lib/money";
import { VendorStatus, type Event, type Vendor } from "../../schemas/event";
import { useEventStore } from "../../store/useEventStore";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

function VendorCard({ event, vendor }: { event: Event; vendor: Vendor }) {
  const updateVendor = useEventStore((s) => s.updateVendor);
  const removeVendor = useEventStore((s) => s.removeVendor);
  const [dialog, setDialog] = useState<"quote" | "edit" | null>(null);
  const money = (n: number) => format(n, event.profile.currency);
  const statusId = `vendor-status-${vendor.id}`;

  return (
    <li className="space-y-3 rounded-xl border border-edge bg-surface shadow-sm p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="mr-auto">
          <h3 className="text-lg font-bold">{vendor.name}</h3>
          <p className="text-sm text-muted">{vendor.category}</p>
          {vendor.contact ? <p className="text-sm">{vendor.contact}</p> : null}
        </div>
        <div>
          <label htmlFor={statusId} className="block text-sm font-semibold">
            Status
          </label>
          <select
            id={statusId}
            className="min-h-11 rounded-lg border border-line bg-surface px-2"
            value={vendor.status}
            onChange={(e) =>
              updateVendor(event.id, vendor.id, { status: VendorStatus.parse(e.target.value) })
            }
          >
            {VendorStatus.options.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {vendor.notes ? <p className="text-sm">{vendor.notes}</p> : null}

      {vendor.quotes.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {vendor.quotes.map((q) => (
            <li key={q.id} className="flex flex-wrap items-center gap-2">
              <Receipt aria-hidden="true" className="h-4 w-4" />
              <span className="font-semibold">{money(q.amount)}</span>
              {q.includes ? <span className="text-muted">{q.includes}</span> : null}
              {q.validUntil ? <span className="text-muted">valid until {q.validUntil}</span> : null}
              {q.accepted ? <Badge tone="ok">Accepted</Badge> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          No quotes yet. Prices only appear once you add a quote.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => setDialog("quote")}
          aria-label={`Add quote from ${vendor.name}`}
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add quote
        </Button>
        <Button
          variant="ghost"
          onClick={() => setDialog("edit")}
          aria-label={`Edit ${vendor.name}`}
        >
          <Pencil aria-hidden="true" className="h-4 w-4" />
          Edit
        </Button>
        <Button
          variant="ghost"
          onClick={() => removeVendor(event.id, vendor.id)}
          aria-label={`Remove ${vendor.name}`}
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
          Remove
        </Button>
      </div>

      <QuestionList event={event} vendor={vendor} />

      {dialog === "quote" ? (
        <QuoteForm
          eventId={event.id}
          vendor={vendor}
          currency={event.profile.currency}
          open
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "edit" ? (
        <VendorForm event={event} vendor={vendor} open onClose={() => setDialog(null)} />
      ) : null}
    </li>
  );
}

export function VendorList({ event }: { event: Event }) {
  const [adding, setAdding] = useState(false);
  const quotedCategories = [
    ...new Set(event.vendors.filter((v) => v.quotes.length > 0).map((v) => v.category)),
  ];

  return (
    <section aria-labelledby="vendors-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="vendors-heading" className="text-xl font-bold">
          Vendors
        </h2>
        <Button variant="secondary" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add a vendor
        </Button>
      </div>
      <p className="text-sm text-muted">
        Hostwise never claims a vendor is available or what they charge. Prices here are only the
        quotes you enter.
      </p>

      {quotedCategories.length > 0 ? (
        <section aria-labelledby="compare-heading" className="space-y-2">
          <h3 id="compare-heading" className="text-lg font-bold">
            Compare quotes
          </h3>
          {quotedCategories.map((c) => (
            <QuoteCompare key={c} event={event} category={c} />
          ))}
        </section>
      ) : null}

      {event.vendors.length === 0 ? (
        <p>No vendors yet. Add one to track quotes and draft questions to ask.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {event.vendors.map((v) => (
            <VendorCard key={v.id} event={event} vendor={v} />
          ))}
        </ul>
      )}
      {adding ? <VendorForm event={event} open onClose={() => setAdding(false)} /> : null}
    </section>
  );
}
