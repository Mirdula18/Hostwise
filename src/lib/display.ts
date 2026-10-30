import { format, parseISO } from "date-fns";
import type { Task } from "../schemas/event";
import { daysBetween } from "./timeline";

/** "Fri 18 Dec 2026" from an ISO `yyyy-MM-dd` date. */
export function formatDate(iso: string): string {
  return format(parseISO(iso), "EEE d MMM yyyy");
}

/** Human countdown to a date: "Today", "Tomorrow", "49 days to go", "3 days ago". */
export function countdown(iso: string, today: string): string {
  const days = daysBetween(today, iso);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `${days} days to go` : `${-days} days ago`;
}

type Progress = { done: number; total: number; percent: number };

/** Share of tasks marked done, rounded down so 100% means everything is done. */
export function taskProgress(tasks: readonly Pick<Task, "status">[]): Progress {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  return { done, total, percent: total === 0 ? 0 : Math.floor((done / total) * 100) };
}

/** Each part's share of the whole as whole percents (for bar widths); zero whole gives zeros. */
export function shares(parts: readonly number[]): number[] {
  const whole = parts.reduce((a, b) => a + Math.max(0, b), 0);
  return parts.map((p) => (whole <= 0 ? 0 : (Math.max(0, p) / whole) * 100));
}
