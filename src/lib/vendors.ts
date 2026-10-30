import { makeId, type IdGen } from "./id";
import { sum } from "./money";
import { err, ok, type Result } from "./result";
import type { BudgetLine, Event, Quote, Vendor } from "../schemas/event";

type QuoteRow = {
  vendorId: string;
  vendorName: string;
  vendorStatus: Vendor["status"];
  quote: Quote;
  over: boolean;
  overBy: number;
};

/** Every quote in a category, cheapest first, flagged when above the allocation. */
export function compareQuotes(
  vendors: readonly Vendor[],
  category: string,
  allocated: number,
): QuoteRow[] {
  return vendors
    .filter((v) => v.category === category)
    .flatMap((v) =>
      v.quotes.map((quote) => ({
        vendorId: v.id,
        vendorName: v.name,
        vendorStatus: v.status,
        quote,
        over: quote.amount > allocated,
        overBy: Math.max(0, quote.amount - allocated),
      })),
    )
    .sort((a, b) => a.quote.amount - b.quote.amount || a.vendorName.localeCompare(b.vendorName));
}

/**
 * Recomputes each line's committed amount from accepted quotes. A line keeps the
 * `quote` source only while it has an accepted quote.
 */
export function syncCommitted(
  lines: readonly BudgetLine[],
  vendors: readonly Vendor[],
): BudgetLine[] {
  return lines.map((line) => {
    const accepted = vendors
      .filter((v) => v.category === line.category)
      .flatMap((v) => v.quotes.filter((q) => q.accepted));
    const committed = sum(accepted.map((q) => q.amount));
    const source =
      accepted.length > 0 ? "quote" : line.source === "quote" ? "estimate" : line.source;
    return committed === line.committed && source === line.source
      ? line
      : { ...line, committed, source };
  });
}

/** Why a quote could not be accepted. */
export type VendorError = "vendor_not_found" | "quote_not_found" | "no_budget_category";

/** Accepts one quote: other quotes from that vendor are unaccepted and the vendor is booked. */
export function acceptQuote(
  event: Event,
  vendorId: string,
  quoteId: string,
  now: string = new Date().toISOString(),
): Result<Event, VendorError> {
  const vendor = event.vendors.find((v) => v.id === vendorId);
  if (!vendor) return err("vendor_not_found");
  if (!vendor.quotes.some((q) => q.id === quoteId)) return err("quote_not_found");
  if (!event.budget.some((l) => l.category === vendor.category)) return err("no_budget_category");

  const vendors = event.vendors.map((v) =>
    v.id === vendorId
      ? {
          ...v,
          status: "booked" as const,
          quotes: v.quotes.map((q) => ({ ...q, accepted: q.id === quoteId })),
        }
      : v,
  );
  return ok({ ...event, vendors, budget: syncCommitted(event.budget, vendors), updatedAt: now });
}

/** Clears an accepted quote and releases the committed amount. */
export function unacceptQuote(event: Event, vendorId: string, quoteId: string): Event {
  const vendors = event.vendors.map((v) =>
    v.id === vendorId
      ? {
          ...v,
          status: v.status === "booked" ? ("quoted" as const) : v.status,
          quotes: v.quotes.map((q) => (q.id === quoteId ? { ...q, accepted: false } : q)),
        }
      : v,
  );
  return { ...event, vendors, budget: syncCommitted(event.budget, vendors) };
}

/** Fields the host can set when adding a vendor. */
export type VendorInput = Pick<Vendor, "name" | "category" | "status"> &
  Partial<Pick<Vendor, "contact" | "notes">>;

/** Adds a vendor with no quotes yet. */
export function addVendor(
  vendors: readonly Vendor[],
  input: VendorInput,
  idGen: IdGen = makeId,
): Vendor[] {
  return [...vendors, { id: idGen("vendor"), quotes: [], ...input }];
}

/** Updates a vendor's details; quotes are changed through their own functions. */
export function updateVendor(
  vendors: readonly Vendor[],
  id: string,
  patch: Partial<Omit<Vendor, "id" | "quotes">>,
): Vendor[] {
  return vendors.map((v) => (v.id === id ? { ...v, ...patch } : v));
}

/** Removes a vendor, unlinks its tasks and recalculates committed amounts. */
export function removeVendor(event: Event, id: string): Event {
  const vendors = event.vendors.filter((v) => v.id !== id);
  return {
    ...event,
    vendors,
    tasks: event.tasks.map((t) => (t.vendorId === id ? { ...t, vendorId: undefined } : t)),
    budget: syncCommitted(event.budget, vendors),
  };
}

/** A quote as the host enters it; ids and acceptance are set by code. */
export type QuoteInput = Omit<Quote, "id" | "accepted">;

/** Adds a user-entered quote; a vendor still "considering"/"contacted" moves to "quoted". */
export function addQuote(
  vendors: readonly Vendor[],
  vendorId: string,
  input: QuoteInput,
  idGen: IdGen = makeId,
): Result<Vendor[], "vendor_not_found" | "invalid_amount"> {
  if (!vendors.some((v) => v.id === vendorId)) return err("vendor_not_found");
  if (!Number.isInteger(input.amount) || input.amount <= 0) return err("invalid_amount");
  return ok(
    vendors.map((v) =>
      v.id === vendorId
        ? {
            ...v,
            status: v.status === "considering" || v.status === "contacted" ? "quoted" : v.status,
            quotes: [...v.quotes, { id: idGen("quote"), accepted: false, ...input }],
          }
        : v,
    ),
  );
}
