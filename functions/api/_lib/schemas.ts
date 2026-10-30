import { z } from "zod";
import { LIMITS, TEXT } from "../../../src/lib/constants";
import {
  AgeGroup,
  EventProfile,
  Impact,
  Occasion,
  Priority,
  Setting,
  TradeOffOption,
} from "../../../src/schemas/event";

/** Request bodies accepted by /api/gemini. Only these tasks exist; there is no raw prompt. */

const Text = (max: number) => z.string().max(max);
const FixHint = { _fixHint: Text(TEXT.LONG_NOTE).optional() };

const IntakeAnswers = z
  .object({
    occasion: Occasion,
    title: Text(TEXT.NAME),
    date: z.string().date(),
    guestCount: z.number().int().min(1).max(LIMITS.GUESTS_MAX),
    totalBudget: z.number().int().positive(),
    currency: Text(LIMITS.CURRENCY_CODE_LENGTH),
    priorities: z.array(Priority).max(LIMITS.PRIORITIES_MAX),
    ageMix: z.array(AgeGroup).max(LIMITS.AGE_GROUPS_MAX),
    accessibility: Text(TEXT.NOTE),
    dietary: Text(TEXT.NOTE),
    culturalContext: Text(TEXT.NOTE),
    setting: Setting,
    city: Text(TEXT.NAME),
  })
  .partial()
  .strict();

export const TaskInputs = {
  intake_next: z
    .object({
      answers: IntakeAnswers,
      asked: z.array(Text(TEXT.LABEL)).max(LIMITS.INTAKE_ASKED_MAX),
      ...FixHint,
    })
    .strict(),
  plan: EventProfile.extend(FixHint).strict(),
  parse_change: z
    .object({
      text: z.string().min(1).max(TEXT.CHANGE),
      today: z.string().date(),
      eventDate: z.string().date(),
      currency: Text(LIMITS.CURRENCY_CODE_LENGTH),
      guestCount: z.number().int().min(1).max(LIMITS.GUESTS_MAX),
      totalBudget: z.number().int().positive(),
      tasks: z
        .array(z.object({ id: Text(TEXT.ID), title: Text(TEXT.TITLE) }).strict())
        .max(LIMITS.CHANGE_TASKS_MAX),
      ...FixHint,
    })
    .strict(),
  rank_options: z
    .object({
      profile: z
        .object({
          priorities: z.array(Priority).min(1).max(LIMITS.PRIORITIES_MAX),
          guestCount: z.number().int().min(1).max(LIMITS.GUESTS_MAX),
          occasion: Occasion,
        })
        .strict(),
      impact: Impact,
      options: z.array(TradeOffOption).min(1).max(LIMITS.RANK_OPTIONS_MAX),
      categories: z
        .array(
          z
            .object({
              category: Text(TEXT.LABEL),
              allocated: z.number().int().min(0),
              locked: z.boolean(),
            })
            .strict(),
        )
        .max(LIMITS.RANK_CATEGORIES_MAX),
      ...FixHint,
    })
    .strict(),
  vendor_questions: z
    .object({
      category: z.string().min(1).max(TEXT.LABEL),
      profile: EventProfile.pick({
        occasion: true,
        guestCount: true,
        accessibility: true,
        dietary: true,
        culturalContext: true,
        setting: true,
      }).strict(),
      ...FixHint,
    })
    .strict(),
} as const;

/** The AI tasks the proxy accepts; there is no free-form prompt task. */
export type TaskName = keyof typeof TaskInputs;
export const TASK_NAMES = Object.keys(TaskInputs) as TaskName[];

export const RequestEnvelope = z
  .object({ task: z.enum(TASK_NAMES as [TaskName, ...TaskName[]]), input: z.unknown() })
  .strict();
