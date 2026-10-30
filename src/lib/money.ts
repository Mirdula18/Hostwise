import { LIMITS } from "./constants";

/** All money is stored as integers in minor units (paise, cents). */
const MINOR_PER_MAJOR = 100;

export function toMinor(major: number): number {
  if (!Number.isFinite(major)) throw new RangeError("Amount must be a finite number");
  return Math.round(major * MINOR_PER_MAJOR);
}

export function fromMinor(minor: number): number {
  return minor / MINOR_PER_MAJOR;
}

const LOCALE_FOR_CURRENCY: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  GBP: "en-GB",
  EUR: "en-IE",
  AUD: "en-AU",
  CAD: "en-CA",
  SGD: "en-SG",
};

const CENT_DIGITS = 2;
const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, fractionDigits: number): Intl.NumberFormat {
  const key = `${currency}:${fractionDigits}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE_FOR_CURRENCY[currency] ?? "en", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatters.set(key, f);
  }
  return f;
}

/** Formats minor units for display; whole amounts drop the decimals. */
export function format(minor: number, currency: string): string {
  const digits = minor % MINOR_PER_MAJOR === 0 ? 0 : CENT_DIGITS;
  return formatter(currency, digits).format(fromMinor(minor));
}

/**
 * Splits `total` into integer parts proportional to `weights` (largest-remainder method).
 * Parts always sum to `total`. Negative weights count as 0; all-zero weights split evenly.
 * Ties on the remainder go to the larger weight, then the earlier index.
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  if (!Number.isInteger(total) || total < 0) {
    throw new RangeError("Total must be a non-negative integer");
  }
  if (weights.length === 0) return [];
  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const weightSum = clean.reduce((a, b) => a + b, 0);
  const effective = weightSum === 0 ? clean.map(() => 1) : clean;
  const effSum = weightSum === 0 ? clean.length : weightSum;

  const exact = effective.map((w) => (total * w) / effSum);
  const parts = exact.map(Math.floor);
  let remainder = total - parts.reduce((a, b) => a + b, 0);

  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x), w: effective[i] ?? 0 }))
    .sort((a, b) => b.frac - a.frac || b.w - a.w || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    parts[i] = (parts[i] ?? 0) + 1;
    remainder -= 1;
  }
  return parts;
}

export function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Parses a typed major-unit amount ("1,250.50") into minor units; null if not a valid amount >= 0. */
export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n <= LIMITS.BUDGET_MAX_MAJOR ? toMinor(n) : null;
}
