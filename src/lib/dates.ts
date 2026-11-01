import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

/** Dates are ISO `yyyy-MM-dd` strings, interpreted as local calendar days. */
export function shiftDate(iso: string, days: number): string {
  return format(addDays(parseISO(iso), days), "yyyy-MM-dd");
}

/** Calendar days from `fromIso` to `toIso`; negative when `toIso` is earlier. */
export function daysBetween(fromIso: string, toIso: string): number {
  return differenceInCalendarDays(parseISO(toIso), parseISO(fromIso));
}

/** Today as a local `yyyy-MM-dd` date. */
export function todayIso(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd");
}

/** True when `iso` is strictly after `today`. */
export function isFutureDate(iso: string, today: string): boolean {
  return daysBetween(today, iso) > 0;
}
