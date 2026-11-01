import { ISO_DATE, LIMITS, TEXT } from "./constants";
import { parseMoney } from "./money";
import { err, ok, type Result } from "./result";
import { clip, optionalText } from "./text";
import type { TaskInput } from "./taskEdit";
import type { QuoteInput, VendorInput } from "./vendors";
import type { ActionableChange, VendorStatus } from "../schemas/event";

/** Validation for the app's forms: raw strings in, typed input or a message out. */

/** A whole number in `[1, max]`, or null. */
function wholeInRange(text: string, max: number): number | null {
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
}

/** Raw vendor form values, as typed. */
export type VendorFields = {
  name: string;
  category: string;
  status: VendorStatus;
  contact: string;
  notes: string;
};

/** Vendor form: the name is required; contact and notes are optional. */
export function vendorInput(f: VendorFields): Result<VendorInput> {
  if (f.name.trim() === "") return err("Enter the vendor's name.");
  return ok({
    name: clip(f.name, TEXT.NAME),
    category: f.category,
    status: f.status,
    ...optionalText("contact", f.contact, TEXT.SHORT_NOTE),
    ...optionalText("notes", f.notes, TEXT.LONG_NOTE),
  });
}

type QuoteFields = {
  amount: string;
  includes: string;
  deposit: string;
  validUntil: string;
  cancellation: string;
};

/** Quote form: a positive amount; the deposit is optional but must be a number if given. */
export function quoteInput(f: QuoteFields): Result<QuoteInput> {
  const amount = parseMoney(f.amount);
  if (amount === null || amount <= 0) return err("Enter the quoted amount, above 0.");
  const deposit = f.deposit.trim() === "" ? undefined : parseMoney(f.deposit);
  if (deposit === null) return err("Enter the deposit as a number, or leave it blank.");
  return ok({
    amount,
    includes: clip(f.includes, TEXT.CHANGE),
    ...(deposit !== undefined ? { deposit } : {}),
    ...(f.validUntil ? { validUntil: f.validUntil } : {}),
    ...optionalText("cancellation", f.cancellation, TEXT.NOTE),
  });
}

/** Raw task form values, as typed. */
export type TaskFields = { title: string; category: string; dueDate: string; dependsOn: string[] };

/** Task form: a title within the limit and a due date. */
export function taskInput(f: TaskFields): Result<TaskInput> {
  if (f.title.trim() === "" || f.title.length > TEXT.TITLE) {
    return err(`Give the task a title (up to ${TEXT.TITLE} characters).`);
  }
  if (!ISO_DATE.test(f.dueDate)) return err("Choose a due date.");
  return ok({
    title: f.title.trim(),
    category: clip(f.category, TEXT.LABEL),
    dueDate: f.dueDate,
    dependsOn: f.dependsOn,
  });
}

/** The four quick-change forms on the change page. */
export type QuickChangeKind = ActionableChange["kind"];

/** The typed quick forms on the change page; they work without the AI. */
export function quickChange(
  kind: QuickChangeKind,
  value: string,
  taskId: string,
): Result<ActionableChange> {
  switch (kind) {
    case "budget": {
      const minor = parseMoney(value);
      return minor === null || minor <= 0
        ? err("Enter the new total budget, above 0.")
        : ok({ kind, newTotal: minor });
    }
    case "guests": {
      const n = wholeInRange(value, LIMITS.GUESTS_MAX);
      return n === null
        ? err(`Enter a whole number of guests between 1 and ${LIMITS.GUESTS_MAX}.`)
        : ok({ kind, newCount: n });
    }
    case "date":
      return ISO_DATE.test(value) ? ok({ kind, newDate: value }) : err("Choose the new date.");
    case "delay":
      return delayChange(value, taskId);
  }
}

function delayChange(value: string, taskId: string): Result<ActionableChange> {
  const n = wholeInRange(value, LIMITS.DELAY_DAYS_MAX);
  return n === null
    ? err(`Enter a delay between 1 and ${LIMITS.DELAY_DAYS_MAX} days.`)
    : ok({ kind: "delay", taskId, days: n });
}

/** Delay dialog: a whole number of days in range, or null. */
export function delayDays(value: string): number | null {
  return wholeInRange(value, LIMITS.DELAY_DAYS_MAX);
}
