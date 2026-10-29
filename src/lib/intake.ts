import type { NextQuestion } from "../schemas/ai";
import { AgeGroup, EventProfile, Occasion, Priority, Setting } from "../schemas/event";
import {
  CURRENCIES,
  FIELD_SPECS,
  MAX_QUESTIONS,
  nextFallbackQuestion,
  OCCASION_LABELS,
  REQUIRED_ORDER,
  type IntakeAnswers,
  type IntakeField,
} from "./intakeFallback";
import { format, fromMinor, toMinor } from "./money";
import { PRIORITY_LABELS } from "./priorities";
import { err, ok, type Result } from "./result";
import { isFutureDate } from "./timeline";

/** A question the UI can render: always tied to a known profile field. */
export type IntakeQuestion = NextQuestion & { done: false; field: IntakeField; question: string };

export const isIntakeField = (f: string | undefined): f is IntakeField =>
  f !== undefined && f in FIELD_SPECS;

/**
 * Makes an AI question safe to render. The AI chooses the wording; code fixes the
 * input type and options for structured fields. Returns null when the AI picked an
 * unknown or already-asked field, so the caller can fall back to the static flow.
 */
export function normalizeQuestion(
  q: NextQuestion,
  answers: IntakeAnswers,
  asked: readonly string[],
): IntakeQuestion | { done: true } | null {
  const missingRequired = REQUIRED_ORDER.some((f) => answers[f] === undefined);
  if (q.done) return missingRequired ? null : { done: true };
  if (!isIntakeField(q.field) || asked.includes(q.field) || answers[q.field] !== undefined) {
    return null;
  }
  const spec = FIELD_SPECS[q.field];
  return {
    done: false,
    field: q.field,
    question: q.question?.trim() || spec.question,
    inputType: spec.inputType,
    ...(spec.options ? { options: spec.options.map((o) => o.value) } : {}),
    ...(q.helper || spec.helper ? { helper: q.helper ?? spec.helper } : {}),
  };
}

/** The static question for the next step, typed for the UI. */
export function fallbackQuestion(
  answers: IntakeAnswers,
  asked: readonly string[],
): IntakeQuestion | { done: true } {
  const q = nextFallbackQuestion(answers, asked);
  return q.done || !isIntakeField(q.field) ? { done: true } : (q as IntakeQuestion);
}

export const reachedLimit = (asked: readonly string[]) => asked.length >= MAX_QUESTIONS;

const TEXT_LIMITS: Partial<Record<IntakeField, number>> = {
  title: 80,
  accessibility: 300,
  dietary: 300,
  culturalContext: 300,
  city: 80,
};

export type Raw = string | string[];

/** Validates one answer and converts it to the profile's types (money → minor units). */
export function parseAnswer(
  field: IntakeField,
  raw: Raw,
  today: string,
): Result<IntakeAnswers[IntakeField], string> {
  const text = typeof raw === "string" ? raw.trim() : "";
  const list = Array.isArray(raw) ? raw : [];
  switch (field) {
    case "occasion": {
      const r = Occasion.safeParse(text);
      return r.success ? ok(r.data) : err("Choose what you're celebrating.");
    }
    case "currency":
      return CURRENCIES.some((c) => c.value === text) ? ok(text) : err("Choose a currency.");
    case "setting": {
      const r = Setting.safeParse(text);
      return r.success ? ok(r.data) : err("Choose indoors, outdoors or either.");
    }
    case "date":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text))) {
        return err("Enter a date.");
      }
      return isFutureDate(text, today) ? ok(text) : err("Choose a date after today.");
    case "guestCount": {
      const n = Number(text);
      if (text === "" || !Number.isInteger(n) || n < 1 || n > 1000) {
        return err("Enter a whole number of guests between 1 and 1000.");
      }
      return ok(n);
    }
    case "totalBudget": {
      const n = Number(text.replace(/[,\s]/g, ""));
      if (text === "" || !Number.isFinite(n) || n <= 0) return err("Enter a budget above 0.");
      if (n > 1e10) return err("That budget is too large.");
      return ok(toMinor(n));
    }
    case "priorities": {
      const valid = list.filter((p) => Priority.safeParse(p).success) as Priority[];
      if (valid.length === 0) return err("Rank at least one priority.");
      return ok(valid.slice(0, 3));
    }
    case "ageMix": {
      const valid = list.filter((a) => AgeGroup.safeParse(a).success) as AgeGroup[];
      return valid.length > 0 ? ok(valid) : err("Choose at least one age group, or skip.");
    }
    default: {
      const max = TEXT_LIMITS[field] ?? 300;
      if (text === "") return err("Type an answer, or skip this question.");
      return text.length > max ? err(`Keep it under ${max} characters.`) : ok(text);
    }
  }
}

/** Builds the final profile, filling in a default title. */
export function finalizeProfile(answers: IntakeAnswers): Result<EventProfile, string> {
  const title =
    answers.title ??
    (answers.occasion && answers.date
      ? `${OCCASION_LABELS[answers.occasion]} on ${answers.date}`
      : undefined);
  const r = EventProfile.safeParse({ ...answers, title });
  if (r.success) return ok(r.data);
  const missing = r.error.issues[0]?.path[0];
  return err(`Some answers are missing or invalid${missing ? ` (${String(missing)})` : ""}.`);
}

/** Human-readable answer for the review list and for the raw form value. */
export function displayAnswer(field: IntakeField, answers: IntakeAnswers): string {
  const v = answers[field];
  if (v === undefined) return "Skipped";
  switch (field) {
    case "occasion":
      return OCCASION_LABELS[v as Occasion];
    case "totalBudget":
      return format(v as number, answers.currency ?? "USD");
    case "priorities":
      return (v as Priority[]).map((p, i) => `${i + 1}. ${PRIORITY_LABELS[p]}`).join(", ");
    case "ageMix":
      return (v as string[]).join(", ");
    default:
      return String(v);
  }
}

/** The value to pre-fill when the user goes back to a question. */
export function rawFor(field: IntakeField, answers: IntakeAnswers): Raw | undefined {
  const v = answers[field];
  if (v === undefined) return undefined;
  if (field === "totalBudget") return String(fromMinor(v as number));
  return Array.isArray(v) ? v.map(String) : String(v);
}
