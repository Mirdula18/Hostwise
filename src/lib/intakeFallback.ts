import type { InputType, NextQuestion } from "../schemas/ai";
import type { EventProfile, Occasion } from "../schemas/event";
import { PRIORITY_LABELS } from "./priorities";

export type IntakeField = keyof EventProfile;
export type IntakeAnswers = Partial<EventProfile>;
type Choice = { value: string; label: string };

type FieldSpec = {
  question: string;
  inputType: InputType;
  required: boolean;
  options?: Choice[];
  helper?: string;
};

export const OCCASION_LABELS: Record<Occasion, string> = {
  birthday: "Birthday",
  kids_birthday: "Kid's birthday",
  anniversary: "Anniversary",
  graduation: "Graduation party",
  engagement: "Engagement",
  community: "Community get-together",
  farewell: "Farewell",
  other: "Something else",
};

const choices = (record: Record<string, string>): Choice[] =>
  Object.entries(record).map(([value, label]) => ({ value, label }));

export const CURRENCIES: Choice[] = [
  { value: "INR", label: "Indian rupee (₹)" },
  { value: "USD", label: "US dollar ($)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "GBP", label: "British pound (£)" },
  { value: "AUD", label: "Australian dollar (A$)" },
  { value: "CAD", label: "Canadian dollar (C$)" },
  { value: "SGD", label: "Singapore dollar (S$)" },
];

export const FIELD_SPECS: Record<IntakeField, FieldSpec> = {
  occasion: {
    question: "What are you celebrating?",
    inputType: "select",
    required: true,
    options: choices(OCCASION_LABELS),
  },
  title: {
    question: "What would you like to call this event?",
    inputType: "text",
    required: false,
    helper: "For example: Mum & Dad's 35th. You can skip this.",
  },
  date: { question: "When is the celebration?", inputType: "date", required: true },
  guestCount: {
    question: "About how many guests are you expecting?",
    inputType: "number",
    required: true,
    helper: "Between 1 and 1000. A best guess is fine.",
  },
  totalBudget: {
    question: "What's your total budget?",
    inputType: "number",
    required: true,
    helper: "Whole amount in your currency. Hostwise will split it for you.",
  },
  currency: {
    question: "Which currency are you budgeting in?",
    inputType: "select",
    required: true,
    options: CURRENCIES,
  },
  priorities: {
    question: "Rank what matters most. The top three shape your budget.",
    inputType: "rank",
    required: true,
    options: choices(PRIORITY_LABELS),
    helper: "Use Move up and Move down. Only the top three are used.",
  },
  ageMix: {
    question: "Which age groups will be there?",
    inputType: "multiselect",
    required: false,
    options: choices({ kids: "Kids", teens: "Teens", adults: "Adults", seniors: "Seniors" }),
  },
  accessibility: {
    question: "Does anyone need accessibility support, like step-free access or seating?",
    inputType: "text",
    required: false,
  },
  dietary: {
    question: "Any dietary needs or allergies to plan around?",
    inputType: "text",
    required: false,
  },
  culturalContext: {
    question: "Any cultural or religious traditions the plan should respect?",
    inputType: "text",
    required: false,
  },
  setting: {
    question: "Indoors or outdoors?",
    inputType: "select",
    required: false,
    options: choices({ indoor: "Indoors", outdoor: "Outdoors", either: "Either is fine" }),
  },
  city: { question: "Which city or area is it in?", inputType: "text", required: false },
};

export const REQUIRED_ORDER: IntakeField[] = [
  "occasion",
  "date",
  "guestCount",
  "totalBudget",
  "currency",
  "priorities",
];

/** Optional follow-ups that matter most for each occasion (at most 4 are asked). */
const OPTIONAL_BY_OCCASION: Record<Occasion, IntakeField[]> = {
  kids_birthday: ["ageMix", "dietary", "setting", "title"],
  anniversary: ["ageMix", "accessibility", "dietary", "culturalContext"],
  birthday: ["title", "setting", "dietary", "city"],
  graduation: ["title", "setting", "dietary", "city"],
  engagement: ["culturalContext", "dietary", "setting", "title"],
  community: ["ageMix", "accessibility", "setting", "dietary"],
  farewell: ["title", "setting", "dietary", "city"],
  other: ["title", "ageMix", "accessibility", "dietary"],
};

export const MAX_QUESTIONS = 10;

export function questionFor(field: IntakeField): NextQuestion {
  const spec = FIELD_SPECS[field];
  return {
    done: false,
    field,
    question: spec.question,
    inputType: spec.inputType,
    ...(spec.options ? { options: spec.options.map((o) => o.value) } : {}),
    ...(spec.helper ? { helper: spec.helper } : {}),
  };
}

/** The static question flow used when the AI is unavailable. */
export function nextFallbackQuestion(
  answers: IntakeAnswers,
  asked: readonly string[],
): NextQuestion {
  const missing = REQUIRED_ORDER.find((f) => answers[f] === undefined);
  if (missing) return questionFor(missing);
  if (asked.length >= MAX_QUESTIONS) return { done: true };
  const optional = OPTIONAL_BY_OCCASION[answers.occasion ?? "other"];
  const next = optional.find((f) => !asked.includes(f) && answers[f] === undefined);
  return next ? questionFor(next) : { done: true };
}
