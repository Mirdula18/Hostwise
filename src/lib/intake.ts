import { ISO_DATE, LIMITS, TEXT } from "./constants";
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
import { nonEmpty } from "./text";
import { isFutureDate } from "./timeline";
import { AgeGroup, EventProfile, Occasion, Priority, Setting } from "../schemas/event";
import type { NextQuestion } from "../schemas/ai";

/** A question the UI can render: always tied to a known profile field. */
export type IntakeQuestion = NextQuestion & { done: false; field: IntakeField; question: string };

/** Narrows a string to a known intake field. */
export const isIntakeField = (f: string | undefined): f is IntakeField =>
  f !== undefined && f in FIELD_SPECS;

/** True when the AI picked a known field that has not been asked or answered yet. */
function isNewField(
  field: string | undefined,
  answers: IntakeAnswers,
  asked: readonly string[],
): field is IntakeField {
  return isIntakeField(field) && !asked.includes(field) && answers[field] === undefined;
}

/** The AI helper wins (even when empty) as long as either helper is set. */
function pickHelper(ai: string | undefined, spec: string | undefined): string | undefined {
  return ai || spec ? (ai ?? spec) : undefined;
}

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
  if (q.done) return REQUIRED_ORDER.some((f) => answers[f] === undefined) ? null : { done: true };
  if (!isNewField(q.field, answers, asked)) return null;
  const spec = FIELD_SPECS[q.field];
  const helper = pickHelper(q.helper, spec.helper);
  return {
    done: false,
    field: q.field,
    question: nonEmpty(q.question) ?? spec.question,
    inputType: spec.inputType,
    ...(spec.options ? { options: spec.options.map((o) => o.value) } : {}),
    ...(helper !== undefined ? { helper } : {}),
  };
}

/** The static question for the next step, typed for the UI. */
export function fallbackQuestion(
  answers: IntakeAnswers,
  asked: readonly string[],
): IntakeQuestion | { done: true } {
  const q = nextFallbackQuestion(answers, asked);
  if (q.done || !isIntakeField(q.field)) return { done: true };
  return {
    ...q,
    done: false,
    field: q.field,
    question: q.question ?? FIELD_SPECS[q.field].question,
  };
}

/** True once the intake has asked its maximum number of questions. */
export const reachedLimit = (asked: readonly string[]) => asked.length >= MAX_QUESTIONS;

const TEXT_LIMITS: Partial<Record<IntakeField, number>> = {
  title: TEXT.NAME,
  accessibility: TEXT.NOTE,
  dietary: TEXT.NOTE,
  culturalContext: TEXT.NOTE,
  city: TEXT.NAME,
};

/** An answer as the form holds it: text, or a list for multi-select and rank. */
export type Raw = string | string[];

type AnswerResult = Result<IntakeAnswers[IntakeField]>;
type AnswerInput = { text: string; list: readonly string[]; today: string };
type AnswerParser = (input: AnswerInput) => AnswerResult;

function parseDate({ text, today }: AnswerInput): AnswerResult {
  if (!ISO_DATE.test(text) || Number.isNaN(Date.parse(text))) return err("Enter a date.");
  return isFutureDate(text, today) ? ok(text) : err("Choose a date after today.");
}

function parseGuestCount({ text }: AnswerInput): AnswerResult {
  const n = Number(text);
  if (text === "" || !Number.isInteger(n) || n < 1 || n > LIMITS.GUESTS_MAX) {
    return err(`Enter a whole number of guests between 1 and ${LIMITS.GUESTS_MAX}.`);
  }
  return ok(n);
}

function parseBudget({ text }: AnswerInput): AnswerResult {
  const n = Number(text.replace(/[,\s]/g, ""));
  if (text === "" || !Number.isFinite(n) || n <= 0) return err("Enter a budget above 0.");
  if (n > LIMITS.BUDGET_MAX_MAJOR) return err("That budget is too large.");
  return ok(toMinor(n));
}

function parsePriorities({ list }: AnswerInput): AnswerResult {
  const valid = list.filter((p): p is Priority => Priority.safeParse(p).success);
  if (valid.length === 0) return err("Rank at least one priority.");
  return ok(valid.slice(0, LIMITS.PRIORITIES_MAX));
}

function parseAgeMix({ list }: AnswerInput): AnswerResult {
  const valid = list.filter((a): a is AgeGroup => AgeGroup.safeParse(a).success);
  return valid.length > 0 ? ok(valid) : err("Choose at least one age group, or skip.");
}

/** Structured fields; every other field is free text with a length limit. */
const PARSERS: Partial<Record<IntakeField, AnswerParser>> = {
  occasion: ({ text }) => {
    const r = Occasion.safeParse(text);
    return r.success ? ok(r.data) : err("Choose what you're celebrating.");
  },
  currency: ({ text }) =>
    CURRENCIES.some((c) => c.value === text) ? ok(text) : err("Choose a currency."),
  setting: ({ text }) => {
    const r = Setting.safeParse(text);
    return r.success ? ok(r.data) : err("Choose indoors, outdoors or either.");
  },
  date: parseDate,
  guestCount: parseGuestCount,
  totalBudget: parseBudget,
  priorities: parsePriorities,
  ageMix: parseAgeMix,
};

function parseText(field: IntakeField, text: string): AnswerResult {
  const max = TEXT_LIMITS[field] ?? TEXT.NOTE;
  if (text === "") return err("Type an answer, or skip this question.");
  return text.length > max ? err(`Keep it under ${max} characters.`) : ok(text);
}

/** Validates one answer and converts it to the profile's types (money → minor units). */
export function parseAnswer(field: IntakeField, raw: Raw, today: string): AnswerResult {
  const text = typeof raw === "string" ? raw.trim() : "";
  const parser = PARSERS[field];
  if (!parser) return parseText(field, text);
  return parser({ text, list: Array.isArray(raw) ? raw : [], today });
}

/** Only the answers for `fields`; used when the host goes back to an earlier question. */
export function keepAnswers(answers: IntakeAnswers, fields: readonly IntakeField[]): IntakeAnswers {
  const kept = new Set<string>(fields);
  return Object.fromEntries(Object.entries(answers).filter(([k]) => kept.has(k)));
}

/** Builds the final profile, filling in a default title. */
export function finalizeProfile(answers: IntakeAnswers): Result<EventProfile> {
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

/** Labels for the structured answers; undefined for plain text and numbers. */
function structuredAnswer(field: IntakeField, a: IntakeAnswers): string | undefined {
  switch (field) {
    case "occasion":
      return a.occasion && OCCASION_LABELS[a.occasion];
    case "totalBudget":
      return a.totalBudget === undefined ? undefined : format(a.totalBudget, a.currency ?? "USD");
    case "priorities":
      return a.priorities?.map((p, i) => `${i + 1}. ${PRIORITY_LABELS[p]}`).join(", ");
    case "ageMix":
      return a.ageMix?.join(", ");
    default:
      return undefined;
  }
}

/** Human-readable answer for the review list and for the raw form value. */
export function displayAnswer(field: IntakeField, answers: IntakeAnswers): string {
  const v = answers[field];
  if (v === undefined) return "Skipped";
  return structuredAnswer(field, answers) ?? String(v);
}

/** The value to pre-fill when the user goes back to a question. */
export function rawFor(field: IntakeField, answers: IntakeAnswers): Raw | undefined {
  const v = answers[field];
  if (v === undefined) return undefined;
  if (field === "totalBudget" && answers.totalBudget !== undefined) {
    return String(fromMinor(answers.totalBudget));
  }
  return Array.isArray(v) ? v.map(String) : String(v);
}
