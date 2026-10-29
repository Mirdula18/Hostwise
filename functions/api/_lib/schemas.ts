import { z } from "zod";
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
const FixHint = { _fixHint: Text(1000).optional() };

const IntakeAnswers = z
  .object({
    occasion: Occasion,
    title: Text(80),
    date: z.string().date(),
    guestCount: z.number().int().min(1).max(1000),
    totalBudget: z.number().int().positive(),
    currency: Text(3),
    priorities: z.array(Priority).max(3),
    ageMix: z.array(AgeGroup).max(4),
    accessibility: Text(300),
    dietary: Text(300),
    culturalContext: Text(300),
    setting: Setting,
    city: Text(80),
  })
  .partial()
  .strict();

export const TaskInputs = {
  intake_next: z
    .object({ answers: IntakeAnswers, asked: z.array(Text(40)).max(20), ...FixHint })
    .strict(),
  plan: EventProfile.extend(FixHint).strict(),
  parse_change: z
    .object({
      text: z.string().min(1).max(500),
      today: z.string().date(),
      eventDate: z.string().date(),
      currency: Text(3),
      guestCount: z.number().int().min(1).max(1000),
      totalBudget: z.number().int().positive(),
      tasks: z.array(z.object({ id: Text(60), title: Text(120) }).strict()).max(60),
      ...FixHint,
    })
    .strict(),
  rank_options: z
    .object({
      profile: z
        .object({
          priorities: z.array(Priority).min(1).max(3),
          guestCount: z.number().int().min(1).max(1000),
          occasion: Occasion,
        })
        .strict(),
      impact: Impact,
      options: z.array(TradeOffOption).min(1).max(6),
      categories: z
        .array(
          z
            .object({
              category: Text(40),
              allocated: z.number().int().min(0),
              locked: z.boolean(),
            })
            .strict(),
        )
        .max(15),
      ...FixHint,
    })
    .strict(),
  vendor_questions: z
    .object({
      category: z.string().min(1).max(40),
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

export type TaskName = keyof typeof TaskInputs;
export const TASK_NAMES = Object.keys(TaskInputs) as TaskName[];

export const RequestEnvelope = z
  .object({ task: z.enum(TASK_NAMES as [TaskName, ...TaskName[]]), input: z.unknown() })
  .strict();
